-- Phase 6: inventory, recipes, costs, margins.

-- An ingredient only drives "Low"/"Sold out" once the owner has entered its stock (restock or recount).
alter table ingredients add column track_stock boolean not null default false;

-- What one unit of a recipe uses. Lines that replace an ingredient (Oat Milk replaces milk) count it negative.
create or replace function public.recipe_needs(p_recipe uuid)
returns table (ingredient_id uuid, qty numeric)
language sql stable set search_path = public as $$
  select x.ingredient_id, sum(x.qty) from (
    select rl.ingredient_id, rl.qty from recipe_lines rl where rl.recipe_id = p_recipe
    union all
    select rl.replaces_ingredient_id, -rl.qty from recipe_lines rl
    where rl.recipe_id = p_recipe and rl.replaces_ingredient_id is not null
  ) x group by x.ingredient_id;
$$;

-- Cost of one unit of a recipe at today's average prices (before overhead).
create or replace function public.recipe_cost(p_recipe uuid)
returns table (ingredient_cost numeric, packaging_cost numeric)
language sql stable set search_path = public as $$
  select coalesce(sum(n.qty * i.avg_unit_cost) filter (where i.kind = 'ingredient'), 0),
         coalesce(sum(n.qty * i.avg_unit_cost) filter (where i.kind = 'packaging'), 0)
  from recipe_needs(p_recipe) n join ingredients i on i.id = n.ingredient_id;
$$;

-- Total stock an order uses. p_snapshot = true uses the recipes saved at confirmation,
-- otherwise today's active recipes (for unconfirmed orders).
create or replace function public.order_needs(p_order uuid, p_snapshot boolean)
returns table (ingredient_id uuid, qty numeric)
language sql stable set search_path = public as $$
  with lines as (
    select oi.qty,
           coalesce(case when p_snapshot then oi.recipe_id end,
                    (select r.id from recipes r where r.menu_item_id = oi.menu_item_id and r.is_active)) as rid
    from order_items oi where oi.order_id = p_order
    union all
    select oi.qty,
           coalesce(case when p_snapshot then a.recipe_id end,
                    (select r.id from recipes r where r.addon_id = a.addon_id and r.is_active))
    from order_item_addons a join order_items oi on oi.id = a.order_item_id
    where oi.order_id = p_order
  )
  select n.ingredient_id, sum(n.qty * l.qty)
  from lines l cross join lateral recipe_needs(l.rid) n
  group by n.ingredient_id;
$$;

-- Confirming a payment saves each drink's recipe + cost and takes its stock out;
-- cancelling a confirmed order puts that stock back.
create or replace function public.on_order_status_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_over numeric;
begin
  if new.status = 'confirmed' and old.status not in ('confirmed', 'ready', 'picked_up') then
    select overhead_pct into v_over from settings where id = 1;

    update order_items oi
       set recipe_id = r.id,
           unit_cost_snapshot = round((c.ingredient_cost + c.packaging_cost) * (1 + v_over / 100), 4)
      from recipes r cross join lateral recipe_cost(r.id) c
     where oi.order_id = new.id and r.menu_item_id = oi.menu_item_id and r.is_active;

    update order_item_addons a
       set recipe_id = r.id,
           unit_cost_snapshot = round((c.ingredient_cost + c.packaging_cost) * (1 + v_over / 100), 4)
      from order_items oi, recipes r cross join lateral recipe_cost(r.id) c
     where a.order_item_id = oi.id and oi.order_id = new.id and r.addon_id = a.addon_id and r.is_active;

    insert into stock_movements (ingredient_id, change, unit_cost, reason, order_id)
    select n.ingredient_id, -n.qty, i.avg_unit_cost, 'order', new.id
    from order_needs(new.id, true) n join ingredients i on i.id = n.ingredient_id
    where n.qty <> 0;

  elsif new.status = 'cancelled' and old.status in ('confirmed', 'ready', 'picked_up') then
    insert into stock_movements (ingredient_id, change, unit_cost, reason, order_id, note)
    select m.ingredient_id, -sum(m.change), max(m.unit_cost), 'order_cancelled', new.id, 'Returned: order cancelled'
    from stock_movements m
    where m.order_id = new.id and m.reason in ('order', 'order_cancelled')
    group by m.ingredient_id
    having sum(m.change) <> 0;
  end if;
  return new;
end;
$$;
revoke execute on function public.on_order_status_stock() from public, anon, authenticated;
create trigger orders_stock after update of status on orders
  for each row execute function public.on_order_status_stock();

-- Live stock picture per ingredient (owner-only via RLS on the underlying tables).
create or replace view public.inventory_status with (security_invoker = true) as
with onhand as (
  select ingredient_id, sum(change) as on_hand from stock_movements group by ingredient_id
),
used14 as (
  select ingredient_id, -sum(change) as used from stock_movements
  where reason in ('order', 'order_cancelled') and created_at > now() - interval '14 days'
  group by ingredient_id
),
reserved as (
  select n.ingredient_id, sum(n.qty) as qty
  from orders o cross join lateral order_needs(o.id, false) n
  where o.status = 'payment_submitted' or (o.status = 'pending_payment' and o.expires_at > now())
  group by n.ingredient_id
),
base as (
  select i.*, coalesce(oh.on_hand, 0) as on_hand, coalesce(r.qty, 0) as reserved,
         coalesce(oh.on_hand, 0) - coalesce(r.qty, 0) as available,
         round(coalesce(u.used, 0) / 14.0, 3) as avg_daily_use
  from ingredients i
  left join onhand oh on oh.ingredient_id = i.id
  left join used14 u on u.ingredient_id = i.id
  left join reserved r on r.ingredient_id = i.id
)
select b.*,
       case when b.avg_daily_use > 0 then round(b.available / b.avg_daily_use, 1) end as days_left,
       case
         when not b.track_stock then 'untracked'
         when b.available <= 0 then 'out'
         when b.available < b.low_threshold or (b.avg_daily_use > 0 and b.available / b.avg_daily_use < 3) then 'low'
         else 'ok'
       end as stock_status
from base b;

-- Products (drinks or add-ons) that can't be made because a tracked ingredient is out.
create or replace function public.sold_out_products()
returns table (product_id uuid)
language sql stable security definer set search_path = public as $$
  select distinct coalesce(r.menu_item_id, r.addon_id)
  from recipes r
  cross join lateral recipe_needs(r.id) n
  join inventory_status s on s.id = n.ingredient_id
  where r.is_active and n.qty > 0 and s.stock_status = 'out';
$$;
revoke execute on function public.sold_out_products() from public;
grant execute on function public.sold_out_products() to anon, authenticated;

-- Owner actions --------------------------------------------------------------------------

-- Restock: adds stock and blends the price into the weighted average cost.
create or replace function public.restock(p_ingredient uuid, p_qty numeric, p_total_price numeric, p_note text default '')
returns void language plpgsql security invoker set search_path = public as $$
declare v_ing ingredients%rowtype; v_on numeric;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_qty is null or p_qty <= 0 or p_total_price is null or p_total_price < 0 then raise exception 'INVALID_INPUT'; end if;
  select * into v_ing from ingredients where id = p_ingredient for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(sum(change), 0) into v_on from stock_movements where ingredient_id = p_ingredient;

  -- First time tracking: forget usage recorded before any stock was entered.
  if not v_ing.track_stock and v_on <> 0 then
    insert into stock_movements (ingredient_id, change, unit_cost, reason, note)
    values (p_ingredient, -v_on, v_ing.avg_unit_cost, 'recount', 'Start tracking stock');
    v_on := 0;
  end if;

  update ingredients
     set avg_unit_cost = (greatest(v_on, 0) * avg_unit_cost + p_total_price) / (greatest(v_on, 0) + p_qty),
         track_stock = true
   where id = p_ingredient;

  insert into stock_movements (ingredient_id, change, unit_cost, reason, note)
  values (p_ingredient, p_qty, p_total_price / p_qty, 'restock', coalesce(p_note, ''));
end;
$$;

-- Waste (amount used up) or recount (what's actually on the shelf). A reason is required.
create or replace function public.adjust_stock(p_ingredient uuid, p_mode text, p_amount numeric, p_note text)
returns void language plpgsql security invoker set search_path = public as $$
declare v_ing ingredients%rowtype; v_on numeric; v_change numeric;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  if p_mode not in ('waste', 'recount') or p_amount is null or p_amount < 0 or length(btrim(coalesce(p_note, ''))) = 0 then
    raise exception 'INVALID_INPUT';
  end if;
  select * into v_ing from ingredients where id = p_ingredient for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  select coalesce(sum(change), 0) into v_on from stock_movements where ingredient_id = p_ingredient;

  v_change := case when p_mode = 'waste' then -p_amount else p_amount - v_on end;
  if v_change <> 0 then
    insert into stock_movements (ingredient_id, change, unit_cost, reason, note)
    values (p_ingredient, v_change, v_ing.avg_unit_cost, p_mode::movement_reason, btrim(p_note));
  end if;
  if p_mode = 'recount' then update ingredients set track_stock = true where id = p_ingredient; end if;
end;
$$;

-- Make one recipe the active one for its product (the others stay as saved versions).
create or replace function public.set_active_recipe(p_recipe uuid)
returns void language plpgsql security invoker set search_path = public as $$
declare v_r recipes%rowtype;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  select * into v_r from recipes where id = p_recipe for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if not exists (select 1 from recipe_lines where recipe_id = p_recipe) then raise exception 'EMPTY_RECIPE'; end if;
  update recipes set is_active = false
   where id <> p_recipe and is_active
     and (menu_item_id = v_r.menu_item_id or addon_id = v_r.addon_id);
  update recipes set is_active = true, archived_at = null where id = p_recipe;
end;
$$;

create or replace function public.duplicate_recipe(p_recipe uuid, p_name text)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_new uuid;
begin
  if not is_admin() then raise exception 'NOT_ALLOWED'; end if;
  insert into recipes (menu_item_id, addon_id, name)
  select menu_item_id, addon_id, left(btrim(p_name), 80) from recipes where id = p_recipe
  returning id into v_new;
  if v_new is null then raise exception 'NOT_FOUND'; end if;
  insert into recipe_lines (recipe_id, ingredient_id, qty, replaces_ingredient_id)
  select v_new, ingredient_id, qty, replaces_ingredient_id from recipe_lines where recipe_id = p_recipe;
  return v_new;
end;
$$;

revoke execute on function public.restock(uuid, numeric, numeric, text) from public, anon;
revoke execute on function public.adjust_stock(uuid, text, numeric, text) from public, anon;
revoke execute on function public.set_active_recipe(uuid) from public, anon;
revoke execute on function public.duplicate_recipe(uuid, text) from public, anon;
grant execute on function public.restock(uuid, numeric, numeric, text) to authenticated;
grant execute on function public.adjust_stock(uuid, text, numeric, text) to authenticated;
grant execute on function public.set_active_recipe(uuid) to authenticated;
grant execute on function public.duplicate_recipe(uuid, text) to authenticated;
grant select on inventory_status to authenticated;

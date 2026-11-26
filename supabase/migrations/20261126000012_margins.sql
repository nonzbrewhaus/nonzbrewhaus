-- Phase 6: margins per product (owner-only via RLS) and a simple period summary.

create or replace view public.product_margins with (security_invoker = true) as
with products as (
  select m.id, 'item'::text as kind, m.category::text as category, m.name, m.price, m.status, m.sort_order from menu_items m
  union all
  select a.id, 'addon', 'addon', a.name, a.price, a.status, 100 + a.sort_order from addons a
),
cfg as (select overhead_pct, margin_target_pct from settings where id = 1)
select p.id, p.kind, p.category, p.name, p.price, p.status, p.sort_order,
       r.id as recipe_id, r.name as recipe_name,
       round(c.ingredient_cost, 2) as ingredient_cost,
       round(c.packaging_cost, 2) as packaging_cost,
       round((c.ingredient_cost + c.packaging_cost) * cfg.overhead_pct / 100, 2) as overhead_cost,
       round((c.ingredient_cost + c.packaging_cost) * (1 + cfg.overhead_pct / 100), 2) as total_cost,
       round(p.price - (c.ingredient_cost + c.packaging_cost) * (1 + cfg.overhead_pct / 100), 2) as profit,
       case when p.price > 0
            then round(100 * (p.price - (c.ingredient_cost + c.packaging_cost) * (1 + cfg.overhead_pct / 100)) / p.price, 1) end as margin_pct,
       cfg.margin_target_pct
from products p
cross join cfg
left join recipes r on r.is_active and (r.menu_item_id = p.id or r.addon_id = p.id)
left join lateral recipe_cost(r.id) c on true
where p.status <> 'archived';

grant select on product_margins to authenticated;

-- Revenue, cost (as saved at confirmation) and profit for orders picked up between two Cairo dates.
create or replace function public.admin_period_summary(p_from date, p_to date) returns jsonb
language sql stable security invoker set search_path = public as $$
  with o as (
    select * from orders
    where status in ('confirmed', 'ready', 'picked_up')
      and pickup_at >= (p_from::timestamp at time zone 'Africa/Cairo')
      and pickup_at <  ((p_to + 1)::timestamp at time zone 'Africa/Cairo')
  ),
  lines as (
    select oi.name_snapshot as name, oi.qty,
           oi.qty * (oi.price_snapshot + coalesce((select sum(a.price_snapshot) from order_item_addons a where a.order_item_id = oi.id), 0)) as revenue,
           oi.qty * (coalesce(oi.unit_cost_snapshot, 0) + coalesce((select sum(a.unit_cost_snapshot) from order_item_addons a where a.order_item_id = oi.id), 0)) as cost
    from order_items oi join o on o.id = oi.order_id
  ),
  by_item as (
    select name, sum(qty) as qty, sum(revenue) as revenue, sum(cost) as cost from lines group by name
  )
  select jsonb_build_object(
    'orders', (select count(*) from o),
    'drinks', coalesce((select sum(qty) from lines), 0),
    'revenue', coalesce((select sum(total) from o), 0),
    'cost', round(coalesce((select sum(cost) from lines), 0), 2),
    'items', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'qty', qty, 'revenue', revenue, 'cost', round(cost, 2)) order by qty desc, revenue desc) from by_item), '[]'::jsonb)
  );
$$;
revoke execute on function public.admin_period_summary(date, date) from public, anon;
grant execute on function public.admin_period_summary(date, date) to authenticated;

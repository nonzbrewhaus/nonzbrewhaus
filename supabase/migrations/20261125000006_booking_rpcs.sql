-- Phase 3: customer booking. Customers never touch tables directly: three RPCs do the work.
-- All are SECURITY DEFINER (customers can't read orders) and validate every input themselves.

-- Orders that currently take up space in a slot.
create or replace function public.order_holds_slot(o orders) returns boolean
language sql stable set search_path = public as $$
  select o.status in ('payment_submitted', 'confirmed', 'ready', 'picked_up')
      or (o.status = 'pending_payment' and o.expires_at > now());
$$;

-- Every bookable slot in the booking window with what's left in it.
create or replace function public.slot_availability()
returns table (pickup_at timestamptz, day date, shift shift_kind, start_time time, end_time time,
               orders_left int, drinks_left int, max_orders int, max_drinks int)
language sql stable security definer set search_path = public as $$
  with cfg as (
    select timezone as tz, booking_days_ahead,
           (now() at time zone timezone)::date as today
    from settings where id = 1
  ),
  days as (
    select (cfg.today + i) as day from cfg, generate_series(0, cfg.booking_days_ahead) i
    where (cfg.today + i) not in (select date from blocked_dates)
  ),
  slots as (
    select d.day, r.shift, r.max_orders_per_slot, r.max_drinks_per_slot, r.slot_minutes,
           gs.ts as local_start,
           gs.ts at time zone (select tz from cfg) as pickup_at
    from days d
    join schedule_rules r on r.weekday = extract(dow from d.day)::int and r.is_open
    cross join lateral generate_series(
      d.day + r.open_time,
      d.day + r.close_time - make_interval(mins => r.slot_minutes),
      make_interval(mins => r.slot_minutes)) gs(ts)
  ),
  used as (
    select o.pickup_at, count(*)::int as n_orders, sum(o.drinks_count)::int as n_drinks
    from orders o where order_holds_slot(o) group by o.pickup_at
  )
  select s.pickup_at, s.day, s.shift, s.local_start::time,
         (s.local_start + make_interval(mins => s.slot_minutes))::time,
         greatest(s.max_orders_per_slot - coalesce(u.n_orders, 0), 0),
         greatest(s.max_drinks_per_slot - coalesce(u.n_drinks, 0), 0),
         s.max_orders_per_slot, s.max_drinks_per_slot
  from slots s left join used u on u.pickup_at = s.pickup_at
  -- Bookable until 10 minutes before the slot ends.
  where s.pickup_at + make_interval(mins => s.slot_minutes) > now() + interval '10 minutes'
  order by s.pickup_at;
$$;

-- Places an order atomically. p_items: [{"item_id": uuid, "qty": 1-10, "addon_ids": [uuid, ...]}]
-- Prices always come from the database, never from the browser. Returns the order code.
create or replace function public.create_order(
  p_name text, p_phone text, p_pickup_at timestamptz, p_items jsonb, p_notes text default '')
returns text
language plpgsql security definer set search_path = public as $$
declare
  v_name   text := btrim(coalesce(p_name, ''));
  v_notes  text := btrim(coalesce(p_notes, ''));
  v_digits text := regexp_replace(coalesce(p_phone, ''), '\D', '', 'g');
  v_phone  text;
  v_slot   record;
  v_drinks int;
  v_line   jsonb;
  v_item   menu_items%rowtype;
  v_addon  addons%rowtype;
  v_addon_id text;
  v_order_id uuid;
  v_item_row uuid;
  v_total  numeric := 0;
  v_unit   numeric;
  v_code   text;
  v_bytes  bytea;
  v_hold   int;
  i int;
begin
  if length(v_name) < 1 or length(v_name) > 80 then raise exception 'INVALID_NAME'; end if;
  if length(v_notes) > 500 then raise exception 'INVALID_NOTES'; end if;

  -- Egyptian mobile: 01xxxxxxxxx, 201xxxxxxxxx or 00201xxxxxxxxx → +201xxxxxxxxx
  if v_digits ~ '^0020' then v_digits := substr(v_digits, 3); end if;
  if v_digits ~ '^01[0125][0-9]{8}$' then v_phone := '+2' || v_digits;
  elsif v_digits ~ '^201[0125][0-9]{8}$' then v_phone := '+' || v_digits;
  else raise exception 'INVALID_PHONE'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'INVALID_ITEMS';
  end if;
  select coalesce(sum((l->>'qty')::int), 0) into v_drinks from jsonb_array_elements(p_items) l;
  if v_drinks < 1 or v_drinks > 30 then raise exception 'INVALID_ITEMS'; end if;

  -- One booking at a time per slot: serialises the capacity check below.
  perform pg_advisory_xact_lock(hashtextextended('slot:' || p_pickup_at::text, 0));

  select * into v_slot from slot_availability() a where a.pickup_at = p_pickup_at;
  if not found then raise exception 'SLOT_UNAVAILABLE'; end if;
  if v_slot.orders_left < 1 or v_slot.drinks_left < v_drinks then raise exception 'SLOT_FULL'; end if;

  -- Stops one phone number from holding many slots without paying.
  if (select count(*) from orders o where o.phone = v_phone and o.status = 'pending_payment' and o.expires_at > now()) >= 2 then
    raise exception 'TOO_MANY_PENDING';
  end if;

  select hold_minutes into v_hold from settings where id = 1;

  loop
    v_bytes := extensions.gen_random_bytes(8);
    v_code := '';
    for i in 0..7 loop
      v_code := v_code || substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + (get_byte(v_bytes, i) % 31), 1);
    end loop;
    exit when not exists (select 1 from orders where code = v_code);
  end loop;

  insert into orders (code, customer_name, phone, pickup_at, drinks_count, total, notes, expires_at)
  values (v_code, v_name, v_phone, p_pickup_at, v_drinks, 0, v_notes, now() + make_interval(mins => v_hold))
  returning id into v_order_id;

  for v_line in select * from jsonb_array_elements(p_items) loop
    if (v_line->>'qty')::int not between 1 and 10 then raise exception 'INVALID_ITEMS'; end if;

    select * into v_item from menu_items where id = (v_line->>'item_id')::uuid and status = 'active';
    if not found then raise exception 'ITEM_UNAVAILABLE'; end if;

    insert into order_items (order_id, menu_item_id, name_snapshot, price_snapshot, qty)
    values (v_order_id, v_item.id, v_item.name, v_item.price, (v_line->>'qty')::int)
    returning id into v_item_row;
    v_unit := v_item.price;

    if jsonb_typeof(coalesce(v_line->'addon_ids', '[]'::jsonb)) <> 'array'
       or jsonb_array_length(coalesce(v_line->'addon_ids', '[]'::jsonb)) > 5 then
      raise exception 'INVALID_ITEMS';
    end if;
    for v_addon_id in select distinct jsonb_array_elements_text(coalesce(v_line->'addon_ids', '[]'::jsonb)) loop
      select * into v_addon from addons where id = v_addon_id::uuid and status = 'active';
      if not found then raise exception 'ITEM_UNAVAILABLE'; end if;
      insert into order_item_addons (order_item_id, addon_id, name_snapshot, price_snapshot)
      values (v_item_row, v_addon.id, v_addon.name, v_addon.price);
      v_unit := v_unit + v_addon.price;
    end loop;

    v_total := v_total + v_unit * (v_line->>'qty')::int;
  end loop;

  update orders set total = v_total where id = v_order_id;
  return v_code;
exception
  when invalid_text_representation then raise exception 'INVALID_ITEMS';
end;
$$;

-- Public order page: look up by its unguessable code. No phone number is returned.
create or replace function public.get_order(p_code text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'code', o.code,
    'name', o.customer_name,
    'status', case when o.status = 'pending_payment' and o.expires_at <= now() then 'expired' else o.status::text end,
    'pickup_at', o.pickup_at,
    'expires_at', o.expires_at,
    'total', o.total,
    'drinks', o.drinks_count,
    'notes', o.notes,
    'has_proof', o.payment_proof_path is not null,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.name_snapshot, 'price', oi.price_snapshot, 'qty', oi.qty,
        'addons', coalesce((select jsonb_agg(jsonb_build_object('name', a.name_snapshot, 'price', a.price_snapshot))
                            from order_item_addons a where a.order_item_id = oi.id), '[]'::jsonb)
      ) order by oi.id)
      from order_items oi where oi.order_id = o.id), '[]'::jsonb)
  )
  from orders o
  where p_code ~ '^[A-HJ-NP-Z2-9]{8}$' and o.code = p_code;
$$;

revoke execute on function public.order_holds_slot(orders) from public, anon, authenticated;
revoke execute on function public.slot_availability() from public;
revoke execute on function public.create_order(text, text, timestamptz, jsonb, text) from public;
revoke execute on function public.get_order(text) from public;
grant execute on function public.slot_availability() to anon, authenticated;
grant execute on function public.create_order(text, text, timestamptz, jsonb, text) to anon, authenticated;
grant execute on function public.get_order(text) to anon, authenticated;

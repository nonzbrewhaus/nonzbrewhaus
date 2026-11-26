-- create_order: also refuse drinks/add-ons that are sold out (a tracked ingredient ran out).
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
  v_sold_out uuid[];
  i int;
begin
  if length(v_name) < 1 or length(v_name) > 80 then raise exception 'INVALID_NAME'; end if;
  if length(v_notes) > 500 then raise exception 'INVALID_NOTES'; end if;

  if v_digits ~ '^0020' then v_digits := substr(v_digits, 3); end if;
  if v_digits ~ '^01[0125][0-9]{8}$' then v_phone := '+2' || v_digits;
  elsif v_digits ~ '^201[0125][0-9]{8}$' then v_phone := '+' || v_digits;
  else raise exception 'INVALID_PHONE'; end if;

  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 20 then
    raise exception 'INVALID_ITEMS';
  end if;
  select coalesce(sum((l->>'qty')::int), 0) into v_drinks from jsonb_array_elements(p_items) l;
  if v_drinks < 1 or v_drinks > 30 then raise exception 'INVALID_ITEMS'; end if;

  perform pg_advisory_xact_lock(hashtextextended('slot:' || p_pickup_at::text, 0));

  select * into v_slot from slot_availability() a where a.pickup_at = p_pickup_at;
  if not found then raise exception 'SLOT_UNAVAILABLE'; end if;
  if v_slot.orders_left < 1 or v_slot.drinks_left < v_drinks then raise exception 'SLOT_FULL'; end if;

  if (select count(*) from orders o where o.phone = v_phone and o.status = 'pending_payment' and o.expires_at > now()) >= 2 then
    raise exception 'TOO_MANY_PENDING';
  end if;

  select hold_minutes into v_hold from settings where id = 1;
  select coalesce(array_agg(product_id), '{}') into v_sold_out from sold_out_products();

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
    if not found or v_item.id = any(v_sold_out) then raise exception 'ITEM_UNAVAILABLE'; end if;

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
      if not found or v_addon.id = any(v_sold_out) then raise exception 'ITEM_UNAVAILABLE'; end if;
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

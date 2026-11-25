-- Phase 5: owner's orders board. SECURITY INVOKER: these run with the caller's rights, so RLS
-- (is_admin()) decides what comes back; a non-admin simply gets an empty list.

create or replace function public.admin_order_json(o orders) returns jsonb
language sql stable security invoker set search_path = public as $$
  select jsonb_build_object(
    'id', o.id, 'code', o.code, 'name', o.customer_name, 'phone', o.phone,
    'status', o.status, 'pickup_at', o.pickup_at, 'expires_at', o.expires_at,
    'total', o.total, 'drinks', o.drinks_count, 'notes', o.notes,
    'proof', o.payment_proof_path, 'created_at', o.created_at,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'name', oi.name_snapshot, 'qty', oi.qty, 'price', oi.price_snapshot,
        'addons', coalesce((select jsonb_agg(a.name_snapshot) from order_item_addons a where a.order_item_id = oi.id), '[]'::jsonb)
      ) order by oi.id)
      from order_items oi where oi.order_id = o.id), '[]'::jsonb));
$$;

-- All orders picked up on one Cairo calendar day, in pickup order.
create or replace function public.admin_orders_for_day(p_day date) returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(admin_order_json(o) order by o.pickup_at, o.created_at), '[]'::jsonb)
  from orders o
  where o.pickup_at >= (p_day::timestamp at time zone 'Africa/Cairo')
    and o.pickup_at <  ((p_day + 1)::timestamp at time zone 'Africa/Cairo');
$$;

-- Every order waiting for the owner to check its receipt, oldest first.
create or replace function public.admin_pending_payments() returns jsonb
language sql stable security invoker set search_path = public as $$
  select coalesce(jsonb_agg(admin_order_json(o) order by o.pickup_at), '[]'::jsonb)
  from orders o where o.status = 'payment_submitted';
$$;

revoke execute on function public.admin_order_json(orders) from public, anon;
revoke execute on function public.admin_orders_for_day(date) from public, anon;
revoke execute on function public.admin_pending_payments() from public, anon;
grant execute on function public.admin_order_json(orders) to authenticated;
grant execute on function public.admin_orders_for_day(date) to authenticated;
grant execute on function public.admin_pending_payments() to authenticated;

-- Live board: stream order changes to signed-in clients (RLS limits them to the owner).
alter publication supabase_realtime add table orders;

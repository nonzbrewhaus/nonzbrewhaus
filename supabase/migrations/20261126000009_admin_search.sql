-- Owner search: order number (with or without #), phone number, or customer name. Newest first, max 50.
-- SECURITY INVOKER: RLS (is_admin) decides, so anyone else gets an empty list.
create or replace function public.admin_search_orders(p_q text) returns jsonb
language sql stable security invoker set search_path = public as $$
  with q as (
    select upper(regexp_replace(btrim(coalesce(p_q, '')), '^#', '')) as code,
           regexp_replace(coalesce(p_q, ''), '\D', '', 'g') as digits,
           btrim(coalesce(p_q, '')) as raw
  )
  select coalesce(jsonb_agg(admin_order_json(o) order by o.created_at desc), '[]'::jsonb)
  from (
    select o.* from orders o, q
    where length(q.raw) >= 2 and (
         o.code = q.code
      or (length(q.code) between 3 and 7 and o.code like q.code || '%')
      or (length(q.digits) >= 4 and regexp_replace(o.phone, '\D', '', 'g') like '%' || ltrim(q.digits, '0') || '%')
      or (q.digits = '' and o.customer_name ilike '%' || replace(replace(q.raw, '%', ''), '_', '') || '%'))
    order by o.created_at desc
    limit 50
  ) o;
$$;
revoke execute on function public.admin_search_orders(text) from public, anon;
grant execute on function public.admin_search_orders(text) to authenticated;

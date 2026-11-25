-- Phase 4: payment screenshot upload, live order status, automatic expiry.

-- Customers may upload a receipt only into the folder of a real order that is still payable,
-- as <CODE>/<uuid>.<ext>, at most 5 files per order. (Codes are 8 random characters, so the
-- folder name is the secret.)
create or replace function public.can_upload_proof(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select p_name ~ '^[A-HJ-NP-Z2-9]{8}/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$'
     and exists (
       select 1 from orders o
       where o.code = split_part(p_name, '/', 1)
         and (o.status = 'payment_submitted' or (o.status = 'pending_payment' and o.expires_at > now())))
     and (select count(*) from storage.objects so
          where so.bucket_id = 'payment-proofs' and so.name like split_part(p_name, '/', 1) || '/%') < 5;
$$;
revoke execute on function public.can_upload_proof(text) from public;
grant execute on function public.can_upload_proof(text) to anon, authenticated;

create policy payment_proofs_customer_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'payment-proofs' and public.can_upload_proof(name));

-- After the file is uploaded, attach it to the order and move it to "Under review".
create or replace function public.submit_payment_proof(p_code text, p_path text) returns text
language plpgsql security definer set search_path = public as $$
begin
  if p_code !~ '^[A-HJ-NP-Z2-9]{8}$'
     or p_path !~ ('^' || p_code || '/[0-9a-f-]{36}\.(jpg|jpeg|png|webp|heic)$')
     or not exists (select 1 from storage.objects where bucket_id = 'payment-proofs' and name = p_path) then
    raise exception 'INVALID_PROOF';
  end if;

  update orders set payment_proof_path = p_path, status = 'payment_submitted'
  where code = p_code
    and (status = 'payment_submitted' or (status = 'pending_payment' and expires_at > now()));
  if not found then raise exception 'ORDER_NOT_PAYABLE'; end if;
  return 'payment_submitted';
end;
$$;
revoke execute on function public.submit_payment_proof(text, text) from public;
grant execute on function public.submit_payment_proof(text, text) to anon, authenticated;

-- Unpaid orders past their hold time become "expired" (capacity is already freed by slot_availability).
create or replace function public.expire_unpaid_orders() returns void
language sql security definer set search_path = public as $$
  update orders set status = 'expired' where status = 'pending_payment' and expires_at <= now();
$$;
revoke execute on function public.expire_unpaid_orders() from public, anon, authenticated;
select cron.schedule('expire-unpaid-orders', '* * * * *', 'select public.expire_unpaid_orders()');

-- Tell the open order page about status changes over a public Realtime broadcast topic
-- named after the (secret) order code; the page then re-fetches via get_order.
create or replace function public.broadcast_order_status() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status is distinct from old.status or new.payment_proof_path is distinct from old.payment_proof_path then
    perform realtime.send(jsonb_build_object('status', new.status), 'status', 'order:' || new.code, false);
  end if;
  return new;
end;
$$;
revoke execute on function public.broadcast_order_status() from public, anon, authenticated;
create trigger orders_broadcast_status after update on orders
  for each row execute function public.broadcast_order_status();

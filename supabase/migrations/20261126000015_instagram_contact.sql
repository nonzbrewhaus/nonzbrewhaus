-- Customers contact the shop through Instagram DM (ig.me/m/<username>); WhatsApp is only a fallback.
alter table settings add column instagram_username text not null default ''
  check (instagram_username ~ '^[A-Za-z0-9._]{0,30}$');

-- What the order page needs to show a contact button. Never returns the phone number itself.
create or replace function public.shop_contact()
returns table (instagram_username text, has_whatsapp boolean)
language sql stable security definer set search_path = public as $$
  select instagram_username, whatsapp_number <> '' from settings where id = 1;
$$;
revoke execute on function public.shop_contact() from public;
grant execute on function public.shop_contact() to anon, authenticated;

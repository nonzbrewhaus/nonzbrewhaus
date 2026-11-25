-- InstaPay payment link (e.g. https://ipn.eg/S/<handle>/instapay/<code>) shown as a "Pay with InstaPay" button.
alter table settings add column instapay_link text not null default ''
  check (instapay_link = '' or instapay_link ~ '^https://[^\s]+$');

-- Customer-safe settings incl. the link (public_settings() is left as-is; the app uses this one).
create function customer_settings()
returns table (instapay_handle text, instapay_link text, whatsapp_number text, hold_minutes int, booking_days_ahead int, timezone text)
language sql stable security definer set search_path = public as $$
  select instapay_handle, instapay_link, whatsapp_number, hold_minutes, booking_days_ahead, timezone from settings where id = 1;
$$;
grant execute on function customer_settings() to anon, authenticated;

-- Only signed-in users need is_admin() (RLS policies for the owner run as authenticated).
-- public_settings() stays public on purpose: it only returns the InstaPay/WhatsApp/booking info customers need.
revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

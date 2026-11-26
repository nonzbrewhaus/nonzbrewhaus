-- Daily low-stock email: remember which day was handled, and call the Edge Function every hour.
-- The function itself decides whether it's time (Settings → low_stock_email_time, Cairo) and sends once a day.
alter table settings add column low_stock_last_sent date;

create extension if not exists pg_net with schema extensions;

-- The publishable key is public (it's in the website too); it only identifies the project.
select cron.schedule(
  'low-stock-email',
  '5 * * * *',
  $$
  select net.http_post(
    url := 'https://zcsnxobgdzczzcxbczfu.supabase.co/functions/v1/low-stock-email',
    headers := '{"Content-Type": "application/json", "apikey": "sb_publishable_9NHp2knrrYQkIdbIqm4Spw_Yrc1VBHL"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
  $$
);

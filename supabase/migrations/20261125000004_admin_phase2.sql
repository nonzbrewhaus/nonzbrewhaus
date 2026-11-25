-- Phase 2: shifts can be switched off per day; paused items come back on their resume date.

alter table schedule_rules add column is_open boolean not null default true;

create extension if not exists pg_cron;

-- Runs at the start of every hour so "back on" happens shortly after midnight Cairo time.
create or replace function resume_paused_items() returns void
language sql security definer set search_path = public as $$
  update menu_items set status = 'active', resume_on = null
   where status = 'paused' and resume_on <= (now() at time zone 'Africa/Cairo')::date;
  update addons set status = 'active', resume_on = null
   where status = 'paused' and resume_on <= (now() at time zone 'Africa/Cairo')::date;
$$;
revoke execute on function resume_paused_items() from public, anon, authenticated;

select cron.schedule('resume-paused-items', '0 * * * *', 'select public.resume_paused_items()');

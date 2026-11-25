-- Nonzz's Brew Haus: initial schema (tables, RLS, admin check).
-- Business functions (create_order, confirm_payment, KPIs) come in later migrations.

create extension if not exists pgcrypto;

-- ---------- enums ----------
create type item_status    as enum ('active', 'paused', 'archived');
create type paused_display as enum ('greyed', 'hidden');
create type menu_category  as enum ('coffee', 'matcha');
create type shift_kind     as enum ('morning', 'evening');
create type order_status   as enum ('pending_payment', 'payment_submitted', 'confirmed', 'ready', 'picked_up', 'expired', 'cancelled');
create type ingredient_kind as enum ('ingredient', 'packaging');
create type unit_kind      as enum ('g', 'ml', 'pcs');
create type movement_reason as enum ('restock', 'order', 'order_cancelled', 'waste', 'recount');

-- ---------- admin ----------
create table admins (
  email text primary key check (email = lower(email))
);

-- Security definer so RLS on admins itself does not block the check.
create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from admins where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- ---------- settings (single row) ----------
create table settings (
  id                  int primary key default 1 check (id = 1),
  instapay_handle     text not null default '',
  whatsapp_number     text not null default '',
  hold_minutes        int  not null default 30 check (hold_minutes between 5 and 240),
  booking_days_ahead  int  not null default 2  check (booking_days_ahead between 0 and 14),
  overhead_pct        numeric(5,2) not null default 10 check (overhead_pct >= 0),
  margin_target_pct   numeric(5,2) not null default 60,
  low_stock_email_time time not null default '07:00',
  week_starts_on      int  not null default 6 check (week_starts_on between 0 and 6), -- 0=Sun … 6=Sat
  timezone            text not null default 'Africa/Cairo'
);

-- ---------- menu ----------
create table menu_items (
  id             uuid primary key default gen_random_uuid(),
  category       menu_category not null,
  name           text not null,
  description    text not null default '',
  price          numeric(10,2) not null check (price >= 0),
  is_signature   boolean not null default false,
  status         item_status not null default 'paused',
  paused_display paused_display not null default 'greyed',
  resume_on      date,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

create table addons (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  price          numeric(10,2) not null check (price >= 0),
  status         item_status not null default 'paused',
  paused_display paused_display not null default 'greyed',
  resume_on      date,
  sort_order     int not null default 0,
  created_at     timestamptz not null default now()
);

-- ---------- schedule ----------
create table schedule_rules (
  id                  uuid primary key default gen_random_uuid(),
  weekday             int not null check (weekday between 0 and 6), -- 0=Sun
  shift               shift_kind not null,
  open_time           time not null,
  close_time          time not null check (close_time > open_time),
  slot_minutes        int not null default 60 check (slot_minutes between 10 and 240),
  max_orders_per_slot int not null default 5  check (max_orders_per_slot > 0),
  max_drinks_per_slot int not null default 10 check (max_drinks_per_slot > 0),
  unique (weekday, shift)
);

create table blocked_dates (
  date   date primary key,
  reason text not null default ''
);

-- ---------- orders ----------
create table orders (
  id                 uuid primary key default gen_random_uuid(),
  code               text not null unique,
  customer_name      text not null check (length(trim(customer_name)) between 1 and 80),
  phone              text not null check (phone ~ '^\+20[0-9]{10}$'), -- normalized Egyptian mobile
  pickup_at          timestamptz not null,
  status             order_status not null default 'pending_payment',
  drinks_count       int not null check (drinks_count > 0),
  total              numeric(10,2) not null check (total >= 0),
  notes              text not null default '' check (length(notes) <= 500),
  payment_proof_path text,
  created_at         timestamptz not null default now(),
  expires_at         timestamptz not null,
  confirmed_at       timestamptz,
  cancelled_at       timestamptz
);
create index orders_pickup_idx on orders (pickup_at);
create index orders_status_idx on orders (status);
create index orders_phone_idx  on orders (phone);

create table order_items (
  id                 uuid primary key default gen_random_uuid(),
  order_id           uuid not null references orders(id) on delete cascade,
  menu_item_id       uuid not null references menu_items(id),
  name_snapshot      text not null,
  price_snapshot     numeric(10,2) not null,
  qty                int not null check (qty > 0),
  recipe_id          uuid,            -- set at confirmation
  unit_cost_snapshot numeric(10,4)    -- set at confirmation
);
create index order_items_order_idx on order_items (order_id);

create table order_item_addons (
  id                 uuid primary key default gen_random_uuid(),
  order_item_id      uuid not null references order_items(id) on delete cascade,
  addon_id           uuid not null references addons(id),
  name_snapshot      text not null,
  price_snapshot     numeric(10,2) not null,
  recipe_id          uuid,
  unit_cost_snapshot numeric(10,4)
);
create index order_item_addons_item_idx on order_item_addons (order_item_id);

-- ---------- inventory ----------
create table ingredients (
  id            uuid primary key default gen_random_uuid(),
  name          text not null unique,
  kind          ingredient_kind not null default 'ingredient',
  unit          unit_kind not null,
  avg_unit_cost numeric(12,4) not null default 0 check (avg_unit_cost >= 0),
  low_threshold numeric(12,2) not null default 0,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now()
);

create table recipes (
  id           uuid primary key default gen_random_uuid(),
  menu_item_id uuid references menu_items(id),
  addon_id     uuid references addons(id),
  name         text not null,
  is_active    boolean not null default false,
  archived_at  timestamptz,
  created_at   timestamptz not null default now(),
  check ((menu_item_id is null) <> (addon_id is null)),
  check (not (is_active and archived_at is not null))
);
-- At most one active recipe per product.
create unique index recipes_one_active_item  on recipes (menu_item_id) where is_active and menu_item_id is not null;
create unique index recipes_one_active_addon on recipes (addon_id)     where is_active and addon_id is not null;

alter table order_items       add foreign key (recipe_id) references recipes(id);
alter table order_item_addons add foreign key (recipe_id) references recipes(id);

create table recipe_lines (
  id                     uuid primary key default gen_random_uuid(),
  recipe_id              uuid not null references recipes(id) on delete cascade,
  ingredient_id          uuid not null references ingredients(id),
  qty                    numeric(12,3) not null check (qty > 0),
  replaces_ingredient_id uuid references ingredients(id)
);
create index recipe_lines_recipe_idx on recipe_lines (recipe_id);

-- Ledger: on_hand = sum(change).
create table stock_movements (
  id            uuid primary key default gen_random_uuid(),
  ingredient_id uuid not null references ingredients(id),
  change        numeric(12,3) not null check (change <> 0),
  unit_cost     numeric(12,4) not null default 0,
  reason        movement_reason not null,
  order_id      uuid references orders(id),
  note          text not null default '',
  created_at    timestamptz not null default now(),
  check (reason not in ('waste', 'recount') or length(trim(note)) > 0)
);
create index stock_movements_ingredient_idx on stock_movements (ingredient_id, created_at);
create index stock_movements_order_idx on stock_movements (order_id);

create view ingredient_stock with (security_invoker = true) as
  select i.*, coalesce(sum(m.change), 0) as on_hand
  from ingredients i left join stock_movements m on m.ingredient_id = i.id
  group by i.id;

-- ---------- RLS ----------
alter table admins            enable row level security;
alter table settings          enable row level security;
alter table menu_items        enable row level security;
alter table addons            enable row level security;
alter table schedule_rules    enable row level security;
alter table blocked_dates     enable row level security;
alter table orders            enable row level security;
alter table order_items       enable row level security;
alter table order_item_addons enable row level security;
alter table ingredients       enable row level security;
alter table recipes           enable row level security;
alter table recipe_lines      enable row level security;
alter table stock_movements   enable row level security;

-- Owner: full access everywhere (admins table has no policy: managed in the dashboard only).
do $$
declare t text;
begin
  foreach t in array array['settings','menu_items','addons','schedule_rules','blocked_dates','orders',
                           'order_items','order_item_addons','ingredients','recipes','recipe_lines','stock_movements']
  loop
    execute format('create policy admin_all on %I for all to authenticated using (is_admin()) with check (is_admin())', t);
  end loop;
end $$;

-- Public: read the visible menu and the schedule only. Orders go through RPCs (later migration).
create policy public_read on menu_items     for select to anon, authenticated using (status <> 'archived');
create policy public_read on addons         for select to anon, authenticated using (status <> 'archived');
create policy public_read on schedule_rules for select to anon, authenticated using (true);
create policy public_read on blocked_dates  for select to anon, authenticated using (true);

-- Public-safe settings (no costs/margins).
create or replace function public_settings()
returns table (instapay_handle text, whatsapp_number text, hold_minutes int, booking_days_ahead int, timezone text)
language sql stable security definer set search_path = public as $$
  select instapay_handle, whatsapp_number, hold_minutes, booking_days_ahead, timezone from settings where id = 1;
$$;
grant execute on function public_settings() to anon, authenticated;

-- ---------- storage: payment proofs (private) ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/jpeg','image/png','image/webp','image/heic'])
on conflict (id) do nothing;

create policy payment_proofs_admin_read on storage.objects
  for select to authenticated using (bucket_id = 'payment-proofs' and is_admin());
-- Uploads happen server-side with signed upload URLs tied to an order code.

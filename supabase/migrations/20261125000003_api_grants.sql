-- This project does not auto-expose new tables to the Data API, so grant explicitly.
-- Grants decide which tables are reachable; RLS policies still decide which rows.

-- TRUNCATE bypasses RLS: nobody on the API gets it.
revoke truncate, trigger, references on all tables in schema public from anon, authenticated;

-- Public (customers): read the menu and schedule only.
grant select on menu_items, addons, schedule_rules, blocked_dates to anon, authenticated;

-- Owner (signed in, gated by is_admin() policies).
grant select, insert, update, delete on
  settings, menu_items, addons, schedule_rules, blocked_dates, orders, order_items,
  order_item_addons, ingredients, recipes, recipe_lines, stock_movements
to authenticated;
grant select on ingredient_stock to authenticated;

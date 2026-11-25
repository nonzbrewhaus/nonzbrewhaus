-- Seed data from brand/menu-design.jpg and brand/pickup-slots-design.png.
-- The owner's admin email is NOT stored here; add it once in the Supabase SQL editor:
--   insert into admins (email) values (lower('<owner email>'));

insert into settings (id) values (1) on conflict (id) do nothing;

insert into menu_items (category, name, price, is_signature, status, sort_order) values
  ('coffee', 'The Nour Signature',          135, true,  'active', 1),
  ('coffee', 'Classic Spanish Latte',       125, false, 'active', 2),
  ('coffee', 'Iced Pumpkin Spice Latte',    150, false, 'active', 3),
  ('coffee', 'Iced Latte',                  125, false, 'active', 4),
  ('coffee', 'Iced White Mocha Latte',      125, false, 'active', 5),
  ('coffee', 'Iced Sea Salt Vanilla Latte', 125, false, 'active', 6),
  ('matcha', 'Iced Sea Salt Matcha',        165, false, 'active', 7),
  ('matcha', 'Iced Spanish Matcha',         165, false, 'active', 8),
  ('matcha', 'Iced Matcha',                 150, false, 'active', 9);

insert into addons (name, price, status, sort_order) values
  ('Sweet Cream Cold Foam', 50, 'active', 1),
  ('Oat Milk',              40, 'active', 2),
  ('Coconut Milk',          40, 'active', 3);

-- Daily: Morning 08:00–15:00, Evening 19:00–22:00; 1-hour slots, 5 orders / 10 drinks (drinks = placeholder).
insert into schedule_rules (weekday, shift, open_time, close_time)
select d, s.shift, s.open_time, s.close_time
from generate_series(0, 6) d
cross join (values ('morning'::shift_kind, time '08:00', time '15:00'),
                   ('evening'::shift_kind, time '19:00', time '22:00')) s(shift, open_time, close_time);

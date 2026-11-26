-- Starter inventory + recipes (Phase 6). Typical amounts for a 16 oz iced drink: the owner corrects them.
-- Costs and stock start at 0; the first restock sets the real average cost and starts tracking.

insert into ingredients (name, kind, unit, low_threshold) values
  ('Espresso beans',           'ingredient', 'g',   500),
  ('Full-cream milk',          'ingredient', 'ml', 2000),
  ('Oat milk',                 'ingredient', 'ml', 1000),
  ('Coconut milk',             'ingredient', 'ml', 1000),
  ('Sweetened condensed milk', 'ingredient', 'ml',  300),
  ('Matcha powder',            'ingredient', 'g',   100),
  ('Vanilla syrup',            'ingredient', 'ml',  200),
  ('Pumpkin spice sauce',      'ingredient', 'ml',  200),
  ('White chocolate sauce',    'ingredient', 'ml',  200),
  ('Heavy cream',              'ingredient', 'ml',  500),
  ('Sugar syrup',              'ingredient', 'ml',  200),
  ('Sea salt',                 'ingredient', 'g',    20),
  ('Cup 16 oz',                'packaging',  'pcs',  30),
  ('Lid',                      'packaging',  'pcs',  30),
  ('Straw',                    'packaging',  'pcs',  30),
  ('Sticker',                  'packaging',  'pcs',  30)
on conflict (name) do nothing;

-- One active starter recipe per product: (product name, is add-on, ingredient, qty, replaces)
with spec(product, is_addon, ingredient, qty, replaces) as (values
  ('The Nour Signature',          false, 'Espresso beans', 18, null), ('The Nour Signature', false, 'Full-cream milk', 180, null),
  ('The Nour Signature',          false, 'Sweetened condensed milk', 30, null), ('The Nour Signature', false, 'Vanilla syrup', 10, null),
  ('Classic Spanish Latte',       false, 'Espresso beans', 18, null), ('Classic Spanish Latte', false, 'Full-cream milk', 180, null),
  ('Classic Spanish Latte',       false, 'Sweetened condensed milk', 30, null),
  ('Iced Pumpkin Spice Latte',    false, 'Espresso beans', 18, null), ('Iced Pumpkin Spice Latte', false, 'Full-cream milk', 200, null),
  ('Iced Pumpkin Spice Latte',    false, 'Pumpkin spice sauce', 25, null),
  ('Iced Latte',                  false, 'Espresso beans', 18, null), ('Iced Latte', false, 'Full-cream milk', 220, null),
  ('Iced White Mocha Latte',      false, 'Espresso beans', 18, null), ('Iced White Mocha Latte', false, 'Full-cream milk', 200, null),
  ('Iced White Mocha Latte',      false, 'White chocolate sauce', 25, null),
  ('Iced Sea Salt Vanilla Latte', false, 'Espresso beans', 18, null), ('Iced Sea Salt Vanilla Latte', false, 'Full-cream milk', 200, null),
  ('Iced Sea Salt Vanilla Latte', false, 'Vanilla syrup', 15, null), ('Iced Sea Salt Vanilla Latte', false, 'Heavy cream', 20, null),
  ('Iced Sea Salt Vanilla Latte', false, 'Sea salt', 0.5, null),
  ('Iced Sea Salt Matcha',        false, 'Matcha powder', 4, null), ('Iced Sea Salt Matcha', false, 'Full-cream milk', 200, null),
  ('Iced Sea Salt Matcha',        false, 'Heavy cream', 20, null), ('Iced Sea Salt Matcha', false, 'Sugar syrup', 10, null),
  ('Iced Sea Salt Matcha',        false, 'Sea salt', 0.5, null),
  ('Iced Spanish Matcha',         false, 'Matcha powder', 4, null), ('Iced Spanish Matcha', false, 'Full-cream milk', 180, null),
  ('Iced Spanish Matcha',         false, 'Sweetened condensed milk', 30, null),
  ('Iced Matcha',                 false, 'Matcha powder', 4, null), ('Iced Matcha', false, 'Full-cream milk', 220, null),
  ('Iced Matcha',                 false, 'Sugar syrup', 10, null),
  ('Sweet Cream Cold Foam',       true,  'Heavy cream', 30, null), ('Sweet Cream Cold Foam', true, 'Full-cream milk', 15, null),
  ('Sweet Cream Cold Foam',       true,  'Vanilla syrup', 10, null),
  ('Oat Milk',                    true,  'Oat milk', 200, 'Full-cream milk'),
  ('Coconut Milk',                true,  'Coconut milk', 200, 'Full-cream milk')
),
packaging(ingredient) as (values ('Cup 16 oz'), ('Lid'), ('Straw'), ('Sticker')),
products as (
  select m.id as menu_item_id, null::uuid as addon_id, m.name, false as is_addon from menu_items m where m.status <> 'archived'
  union all
  select null, a.id, a.name, true from addons a where a.status <> 'archived'
),
new_recipes as (
  insert into recipes (menu_item_id, addon_id, name, is_active)
  select p.menu_item_id, p.addon_id, 'Starter – please check', true
  from products p
  where exists (select 1 from spec s where s.product = p.name and s.is_addon = p.is_addon)
    and not exists (select 1 from recipes r where r.menu_item_id = p.menu_item_id or r.addon_id = p.addon_id)
  returning id, menu_item_id, addon_id
)
insert into recipe_lines (recipe_id, ingredient_id, qty, replaces_ingredient_id)
select nr.id, i.id, s.qty, ri.id
from new_recipes nr
join products p on p.menu_item_id is not distinct from nr.menu_item_id and p.addon_id is not distinct from nr.addon_id
join spec s on s.product = p.name and s.is_addon = p.is_addon
join ingredients i on i.name = s.ingredient
left join ingredients ri on ri.name = s.replaces
union all
-- Every drink (not add-ons) uses one cup, lid, straw and sticker.
select nr.id, i.id, 1, null
from new_recipes nr
join packaging pk on true
join ingredients i on i.name = pk.ingredient
where nr.menu_item_id is not null;

import { test } from "node:test";
import assert from "node:assert/strict";
import { marginPct, recipeCost } from "./costing.ts";

const ings = new Map([
  ["beans", { id: "beans", kind: "ingredient" as const, avg_unit_cost: 0.9 }],
  ["milk", { id: "milk", kind: "ingredient" as const, avg_unit_cost: 0.07 }],
  ["oat", { id: "oat", kind: "ingredient" as const, avg_unit_cost: 0.15 }],
  ["cup", { id: "cup", kind: "packaging" as const, avg_unit_cost: 2 }],
]);

test("matches the database test case: Iced Latte = 31.60, +10% overhead = 34.76", () => {
  const c = recipeCost(
    [
      { ingredient_id: "beans", qty: 18, replaces_ingredient_id: null },
      { ingredient_id: "milk", qty: 220, replaces_ingredient_id: null },
    ],
    ings,
    10,
  );
  assert.equal(c.ingredient.toFixed(2), "31.60");
  assert.equal(c.total.toFixed(2), "34.76");
});

test("replacement lines only add the price difference (Oat Milk add-on)", () => {
  const c = recipeCost([{ ingredient_id: "oat", qty: 200, replaces_ingredient_id: "milk" }], ings, 0);
  assert.equal(c.ingredient.toFixed(2), "16.00"); // 200 × (0.15 − 0.07)
});

test("packaging is split out; margin %", () => {
  const c = recipeCost([{ ingredient_id: "cup", qty: 1, replaces_ingredient_id: null }], ings, 0);
  assert.equal(c.packaging, 2);
  assert.equal(marginPct(125, 25), 80);
  assert.equal(marginPct(0, 5), null);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { addLine, cartTotals, dayLabel, formatSlotTime, lineKey, normalizeEgPhone, removeLine, removeOne, setNote, setQty, type CartLine } from "./booking.ts";

const latte = { itemId: "latte", name: "Iced Latte", category: "coffee" as const, price: 125 };
const oat = { id: "oat", name: "Oat Milk", price: 40 };
const foam = { id: "foam", name: "Cold Foam", price: 50 };

test("same drink + same add-ons stacks; add-on order doesn't matter", () => {
  let lines: CartLine[] = [];
  lines = addLine(lines, { ...latte, addons: [oat, foam] });
  lines = addLine(lines, { ...latte, addons: [foam, oat] });
  lines = addLine(lines, { ...latte, addons: [] });
  assert.equal(lines.length, 2);
  assert.equal(lines[0].qty, 2);
  assert.equal(lineKey("latte", ["oat", "foam"]), lineKey("latte", ["foam", "oat"]));
});

test("totals include add-ons per drink", () => {
  let lines: CartLine[] = [];
  lines = addLine(lines, { ...latte, addons: [oat] });
  lines = addLine(lines, { ...latte, addons: [oat] });
  lines = addLine(lines, { ...latte, addons: [] });
  assert.deepEqual(cartTotals(lines), { drinks: 3, total: 165 * 2 + 125 });
});

test("removeOne drops the line at zero", () => {
  let lines = addLine([], { ...latte, addons: [] });
  lines = removeOne(lines, lines[0].key);
  assert.equal(lines.length, 0);
});

test("setQty clamps to 0–10 and removes at 0; removeLine; setNote keeps the line and trims length", () => {
  let lines = addLine([], { ...latte, addons: [] });
  const key = lines[0].key;
  lines = setQty(lines, key, 25);
  assert.equal(lines[0].qty, 10);
  lines = setNote(lines, key, "less ice " + "x".repeat(200));
  assert.equal(lines[0].note?.length, 120);
  assert.ok(lines[0].note?.startsWith("less ice"));
  lines = addLine(lines, { ...latte, addons: [] }); // stays at max, note kept
  assert.equal(lines[0].qty, 10);
  assert.ok(lines[0].note);
  assert.equal(setQty(lines, key, 0).length, 0);
  assert.equal(removeLine(lines, key).length, 0);
});

test("normalizeEgPhone matches the database rule", () => {
  assert.equal(normalizeEgPhone("0100 123 4567"), "+201001234567");
  assert.equal(normalizeEgPhone("+20 112 345 6789"), "+201123456789");
  assert.equal(normalizeEgPhone("00201551234567"), "+201551234567");
  assert.equal(normalizeEgPhone("0131234567"), null);
  assert.equal(normalizeEgPhone("12345"), null);
});

test("formatSlotTime", () => {
  assert.equal(formatSlotTime("08:00:00", "09:00:00"), "8 – 9 AM");
  assert.equal(formatSlotTime("11:00:00", "12:00:00"), "11 AM – 12 PM");
  assert.equal(formatSlotTime("08:30:00", "09:00:00"), "8:30 – 9 AM");
  assert.equal(formatSlotTime("21:30:00", "22:00:00"), "9:30 – 10 PM");
});

test("dayLabel", () => {
  assert.equal(dayLabel("2026-11-25", "2026-11-25").label, "Today");
  assert.equal(dayLabel("2026-11-26", "2026-11-25").label, "Tomorrow");
  assert.deepEqual(dayLabel("2026-11-27", "2026-11-25"), { label: "Fri", sub: "27 Nov" });
});

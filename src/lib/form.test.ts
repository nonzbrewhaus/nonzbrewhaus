// Run: node --test src/lib/form.test.ts  (Node 22.18+ strips TypeScript types natively)
import { test } from "node:test";
import assert from "node:assert/strict";
import { text, num, oneOf, bool, time, optionalDate, uuid, InputError } from "./form.ts";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

test("text trims and enforces length", () => {
  assert.equal(text(fd({ name: "  Latte " }), "name", { min: 1 }), "Latte");
  assert.throws(() => text(fd({ name: "  " }), "name", { min: 1 }), InputError);
  assert.throws(() => text(fd({ name: "x".repeat(5) }), "name", { max: 4 }), InputError);
});

test("num rejects empty, NaN, out of range and non-integers when int", () => {
  assert.equal(num(fd({ price: "125.5" }), "price"), 125.5);
  assert.throws(() => num(fd({ price: "" }), "price"), InputError);
  assert.throws(() => num(fd({ price: "abc" }), "price"), InputError);
  assert.throws(() => num(fd({ price: "-1" }), "price"), InputError);
  assert.throws(() => num(fd({ n: "2.5" }), "n", { int: true }), InputError);
});

test("oneOf only accepts listed values", () => {
  assert.equal(oneOf(fd({ s: "paused" }), "s", ["active", "paused"] as const), "paused");
  assert.throws(() => oneOf(fd({ s: "deleted" }), "s", ["active", "paused"] as const), InputError);
});

test("bool, time, optionalDate, uuid", () => {
  assert.equal(bool(fd({ x: "on" }), "x"), true);
  assert.equal(bool(fd({}), "x"), false);
  assert.equal(time(fd({ t: "08:00:00" }), "t"), "08:00");
  assert.throws(() => time(fd({ t: "24:00" }), "t"), InputError);
  assert.equal(optionalDate(fd({ d: "" }), "d"), null);
  assert.equal(optionalDate(fd({ d: "2026-12-01" }), "d"), "2026-12-01");
  assert.throws(() => optionalDate(fd({ d: "12/01/2026" }), "d"), InputError);
  assert.throws(() => uuid("1; drop table"), InputError);
});

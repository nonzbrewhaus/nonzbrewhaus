import { test } from "node:test";
import assert from "node:assert/strict";
import { fmtQty, fmtUnitCost } from "./units.ts";

test("fmtQty switches to kg / L at 1000", () => {
  assert.equal(fmtQty(2500, "g"), "2.5 kg");
  assert.equal(fmtQty(750, "ml"), "750 ml");
  assert.equal(fmtQty(1000, "ml"), "1 L");
  assert.equal(fmtQty(12, "pcs"), "12 pcs");
  assert.equal(fmtQty(-40, "ml"), "-40 ml");
  assert.equal(fmtQty(0.5, "g"), "0.5 g");
});

test("fmtUnitCost shows per kg / L / piece", () => {
  assert.equal(fmtUnitCost(0.07, "ml"), "70 EGP / L");
  assert.equal(fmtUnitCost(0.9, "g"), "900 EGP / kg");
  assert.equal(fmtUnitCost(1.25, "pcs"), "1.25 EGP / pc");
});

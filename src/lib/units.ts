// Human-friendly stock amounts: 2500 g → "2.5 kg", 750 ml → "750 ml", 12 pcs → "12 pcs".
export function fmtQty(n: number, unit: "g" | "ml" | "pcs"): string {
  const v = Number(n);
  if (unit !== "pcs" && Math.abs(v) >= 1000) {
    return `${trim(v / 1000)} ${unit === "g" ? "kg" : "L"}`;
  }
  return `${trim(v)} ${unit}`;
}

/** Cost per unit shown per sensible pack: per kg / per L / per piece. */
export function fmtUnitCost(costPerUnit: number, unit: "g" | "ml" | "pcs"): string {
  const c = Number(costPerUnit);
  if (unit === "pcs") return `${trim(c)} EGP / pc`;
  return `${trim(c * 1000)} EGP / ${unit === "g" ? "kg" : "L"}`;
}

function trim(v: number) {
  return Number.isInteger(v) ? String(v) : v.toFixed(Math.abs(v) < 10 ? 2 : 1).replace(/\.?0+$/, "");
}

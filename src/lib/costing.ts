// Mirrors the database's recipe_cost(): lines that replace an ingredient subtract its cost.
export type CostIngredient = { id: string; kind: "ingredient" | "packaging"; avg_unit_cost: number };
export type CostLine = { ingredient_id: string; qty: number; replaces_ingredient_id: string | null };

export function recipeCost(lines: CostLine[], ingredients: Map<string, CostIngredient>, overheadPct: number) {
  let ingredient = 0;
  let packaging = 0;
  const add = (id: string, qty: number) => {
    const ing = ingredients.get(id);
    if (!ing) return;
    const c = qty * Number(ing.avg_unit_cost);
    if (ing.kind === "packaging") packaging += c;
    else ingredient += c;
  };
  for (const l of lines) {
    add(l.ingredient_id, Number(l.qty));
    if (l.replaces_ingredient_id) add(l.replaces_ingredient_id, -Number(l.qty));
  }
  const base = ingredient + packaging;
  const overhead = (base * overheadPct) / 100;
  return { ingredient, packaging, overhead, total: base + overhead };
}

export function marginPct(price: number, totalCost: number): number | null {
  return price > 0 ? ((price - totalCost) / price) * 100 : null;
}

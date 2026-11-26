import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { marginPct, recipeCost, type CostIngredient } from "@/lib/costing";
import { addLine, archiveRecipe, createRecipe, duplicateRecipe, removeLine, renameRecipe, setActiveRecipe, updateLine } from "./actions";

type Unit = "g" | "ml" | "pcs";
type Ingredient = CostIngredient & { name: string; unit: Unit; is_active: boolean };
type Line = { id: string; ingredient_id: string; qty: number; replaces_ingredient_id: string | null };
type Recipe = { id: string; menu_item_id: string | null; addon_id: string | null; name: string; is_active: boolean; archived_at: string | null; created_at: string; recipe_lines: Line[] };
type Product = { id: string; kind: "item" | "addon"; name: string; price: number; status: string };

const egp = (n: number) => `${n.toFixed(2)} EGP`;

export default function RecipesPage() {
  return (
    <Suspense fallback={<p className="card p-6">Loading recipes…</p>}>
      <Recipes />
    </Suspense>
  );
}

async function Recipes() {
  const { supabase } = await requireAdmin();
  const [ingRes, recRes, itemsRes, addonsRes, setRes] = await Promise.all([
    supabase.from("ingredients").select("id, name, kind, unit, avg_unit_cost, is_active").order("name"),
    supabase.from("recipes").select("id, menu_item_id, addon_id, name, is_active, archived_at, created_at, recipe_lines(id, ingredient_id, qty, replaces_ingredient_id)").order("created_at"),
    supabase.from("menu_items").select("id, name, price, status").neq("status", "archived").order("sort_order"),
    supabase.from("addons").select("id, name, price, status").neq("status", "archived").order("sort_order"),
    supabase.from("settings").select("overhead_pct, margin_target_pct").eq("id", 1).single(),
  ]);
  const err = ingRes.error ?? recRes.error ?? itemsRes.error ?? addonsRes.error ?? setRes.error;
  if (err) throw err;

  const ingredients = ingRes.data as Ingredient[];
  const ingMap = new Map(ingredients.map((i) => [i.id, i]));
  const recipes = recRes.data as Recipe[];
  const overhead = Number(setRes.data?.overhead_pct ?? 0);
  const target = Number(setRes.data?.margin_target_pct ?? 60);
  const products: Product[] = [
    ...(itemsRes.data ?? []).map((p) => ({ ...p, price: Number(p.price), kind: "item" as const })),
    ...(addonsRes.data ?? []).map((p) => ({ ...p, price: Number(p.price), kind: "addon" as const })),
  ];

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <h1 className="font-serif text-3xl font-bold italic">Recipes</h1>
        <p className="mt-1 text-sm">
          Each drink and add-on can have several recipes; exactly <strong>one is active</strong>, and that&apos;s the one confirmed orders
          take from your stock. To try a change safely: <strong>Copy</strong> the active recipe, edit the copy, compare the cost, then
          <strong> Set active</strong>. Costs use your average ingredient prices plus {overhead}% overhead; target margin {target}%.
        </p>
      </section>

      {products.map((p) => {
        const list = recipes
          .filter((r) => (p.kind === "item" ? r.menu_item_id === p.id : r.addon_id === p.id))
          .sort((a, b) => Number(b.is_active) - Number(a.is_active) || Number(!!a.archived_at) - Number(!!b.archived_at));
        const active = list.find((r) => r.is_active);
        const activeCost = active ? recipeCost(active.recipe_lines, ingMap, overhead) : null;
        const activeMargin = activeCost ? marginPct(p.price, activeCost.total) : null;

        return (
          <section key={p.id} className="card p-4 sm:p-5">
            <details>
              <summary className="flex cursor-pointer flex-wrap items-baseline gap-x-3 gap-y-1">
                <h2 className="font-serif text-2xl font-bold italic">{p.name}</h2>
                {p.kind === "addon" && <span className="text-xs uppercase tracking-widest">add-on</span>}
                <span className="text-sm">{p.price} EGP</span>
                <span className="ml-auto text-sm">
                  {active ? (
                    <>
                      cost <strong>{egp(activeCost!.total)}</strong>
                      {activeMargin !== null && (
                        <span className={activeMargin < target ? "font-bold text-red-800" : ""}> · margin {activeMargin.toFixed(0)}%</span>
                      )}
                    </>
                  ) : (
                    <strong className="text-red-800">No active recipe</strong>
                  )}
                </span>
              </summary>

              <div className="mt-3 space-y-4">
                {list.map((r) => (
                  <RecipeCard key={r.id} r={r} product={p} ingredients={ingredients} ingMap={ingMap} overhead={overhead} target={target} />
                ))}
                <ActionForm action={createRecipe.bind(null, p.kind, p.id)} submitLabel="New empty recipe" variant="secondary" className="flex flex-wrap items-end gap-2">
                  <label className="block text-sm font-semibold">Name
                    <input name="name" required maxLength={80} placeholder="e.g. v2 double shot" className="field mt-1" />
                  </label>
                </ActionForm>
              </div>
            </details>
          </section>
        );
      })}
    </div>
  );
}

function RecipeCard({
  r, product, ingredients, ingMap, overhead, target,
}: { r: Recipe; product: Product; ingredients: Ingredient[]; ingMap: Map<string, Ingredient>; overhead: number; target: number }) {
  const cost = recipeCost(r.recipe_lines, ingMap, overhead);
  const margin = marginPct(product.price, cost.total);
  const archived = !!r.archived_at;

  return (
    <article className={`rounded-2xl border-[1.5px] border-brown bg-[#FFF8F4] p-3.5 ${archived ? "opacity-60" : ""}`} aria-label={`Recipe ${r.name}`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">{r.name}</h3>
        {r.is_active && <span className="rounded-full border-[1.5px] border-brown bg-[#BFE3C6] px-2 py-0.5 text-xs font-bold">Active</span>}
        {archived && <span className="rounded-full border-[1.5px] border-brown bg-[#E3E0DD] px-2 py-0.5 text-xs font-bold">Archived</span>}
      </div>
      <p className="mt-1 text-sm">
        Ingredients {egp(cost.ingredient)} · packaging {egp(cost.packaging)} · overhead {egp(cost.overhead)} · <strong>total {egp(cost.total)}</strong>
        {margin !== null && (
          <>
            {" "}· profit {egp(product.price - cost.total)} ·{" "}
            <strong className={margin < target ? "text-red-800" : ""}>margin {margin.toFixed(1)}%</strong>
          </>
        )}
      </p>

      <ul className="mt-2 divide-y divide-brown/15 text-sm">
        {r.recipe_lines.map((l) => {
          const ing = ingMap.get(l.ingredient_id);
          const rep = l.replaces_ingredient_id ? ingMap.get(l.replaces_ingredient_id) : null;
          return (
            <li key={l.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <span className="min-w-40 flex-1">
                {ing?.name ?? "?"}
                {rep && <span className="text-xs"> (replaces {rep.name})</span>}
              </span>
              <ActionForm action={updateLine.bind(null, l.id)} submitLabel="Save" variant="secondary" className="flex items-center gap-2">
                <label className="sr-only" htmlFor={`q-${l.id}`}>Amount of {ing?.name}</label>
                <input id={`q-${l.id}`} name="qty" type="number" min="0.001" step="any" required defaultValue={Number(l.qty)} className="field !min-h-10 !w-24 !py-1" />
                <span className="w-8">{ing?.unit}</span>
              </ActionForm>
              <ActionForm action={removeLine.bind(null, l.id)} submitLabel="Remove" variant="danger" confirm={`Remove ${ing?.name} from "${r.name}"?`} />
            </li>
          );
        })}
        {r.recipe_lines.length === 0 && <li className="py-1.5">No ingredients yet.</li>}
      </ul>

      <ActionForm action={addLine.bind(null, r.id)} submitLabel="Add ingredient" variant="secondary" className="mt-3 flex flex-wrap items-end gap-2">
        <label className="block text-sm font-semibold">Ingredient
          <select name="ingredient_id" required className="field mt-1 !w-auto">
            {ingredients.filter((i) => i.is_active).map((i) => (
              <option key={i.id} value={i.id}>{i.name} ({i.unit})</option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-semibold">Amount
          <input name="qty" type="number" min="0.001" step="any" required className="field mt-1 !w-24" />
        </label>
        {product.kind === "addon" && (
          <label className="block text-sm font-semibold">Replaces (optional)
            <select name="replaces" defaultValue="" className="field mt-1 !w-auto">
              <option value="">Nothing</option>
              {ingredients.filter((i) => i.is_active).map((i) => (
                <option key={i.id} value={i.id}>{i.name}</option>
              ))}
            </select>
          </label>
        )}
      </ActionForm>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-brown/15 pt-3">
        {!r.is_active && <ActionForm action={setActiveRecipe.bind(null, r.id)} submitLabel="Set active" />}
        <ActionForm action={duplicateRecipe.bind(null, r.id)} submitLabel="Copy" variant="secondary" className="flex items-end gap-2">
          <label className="block text-sm font-semibold">Copy as
            <input name="name" required maxLength={80} defaultValue={`${r.name} (copy)`} className="field mt-1 !min-h-10 !py-1" />
          </label>
        </ActionForm>
        <ActionForm action={renameRecipe.bind(null, r.id)} submitLabel="Rename" variant="secondary" className="flex items-end gap-2">
          <label className="block text-sm font-semibold">Name
            <input name="name" required maxLength={80} defaultValue={r.name} className="field mt-1 !min-h-10 !py-1" />
          </label>
        </ActionForm>
        {!r.is_active && !archived && (
          <ActionForm action={archiveRecipe.bind(null, r.id)} submitLabel="Archive" variant="danger" confirm={`Archive "${r.name}"? Past orders keep it.`} />
        )}
      </div>
    </article>
  );
}

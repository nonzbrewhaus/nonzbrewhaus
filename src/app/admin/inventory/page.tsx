import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { cairoDateTime } from "@/lib/cairo";
import { fmtQty, fmtUnitCost } from "@/lib/units";
import { addIngredient, adjustIngredient, restockIngredient, updateIngredient } from "./actions";

type Unit = "g" | "ml" | "pcs";
type Row = {
  id: string;
  name: string;
  kind: "ingredient" | "packaging";
  unit: Unit;
  avg_unit_cost: number;
  low_threshold: number;
  is_active: boolean;
  track_stock: boolean;
  on_hand: number;
  reserved: number;
  available: number;
  avg_daily_use: number;
  days_left: number | null;
  stock_status: "untracked" | "out" | "low" | "ok";
};
type Movement = { ingredient_id: string; change: number; reason: string; note: string; created_at: string; unit_cost: number };

const STOCK_BADGE: Record<Row["stock_status"], { text: string; cls: string }> = {
  out: { text: "Out", cls: "bg-[#E8A6A6]" },
  low: { text: "Low", cls: "bg-[#F6D58E]" },
  ok: { text: "OK", cls: "bg-[#BFE3C6]" },
  untracked: { text: "Not tracked yet", cls: "bg-[#E3E0DD]" },
};
const ORDER = { out: 0, low: 1, ok: 2, untracked: 3 };
const REASON: Record<string, string> = {
  restock: "Restock",
  order: "Orders",
  order_cancelled: "Returned (cancelled order)",
  waste: "Waste",
  recount: "Recount",
};

export default function InventoryPage() {
  return (
    <Suspense fallback={<p className="card p-6">Loading inventory…</p>}>
      <Inventory />
    </Suspense>
  );
}

async function Inventory() {
  const { supabase } = await requireAdmin();
  const [rowsRes, movRes] = await Promise.all([
    supabase.from("inventory_status").select("*"),
    supabase.from("stock_movements").select("ingredient_id, change, reason, note, created_at, unit_cost").order("created_at", { ascending: false }).limit(400),
  ]);
  if (rowsRes.error || movRes.error) throw rowsRes.error ?? movRes.error;
  const rows = (rowsRes.data as Row[]).sort((a, b) => ORDER[a.stock_status] - ORDER[b.stock_status] || a.name.localeCompare(b.name));
  const moves = movRes.data as Movement[];
  const alerts = rows.filter((r) => r.is_active && (r.stock_status === "out" || r.stock_status === "low"));

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <h1 className="font-serif text-3xl font-bold italic">Inventory</h1>
        <p className="mt-1 text-sm">
          <strong>On hand</strong> is what you have now (confirmed orders are already taken out). <strong>Reserved</strong> is what
          unpaid and under-review orders will use. <strong>Days left</strong> uses your average use over the last 14 days. An item
          starts counting toward <em>Low</em> / <em>Sold out</em> after its first restock or count.
        </p>
        {alerts.length > 0 && (
          <p role="alert" className="mt-3 rounded-xl border-[1.5px] border-brown bg-[#F6D58E] p-3 text-sm font-semibold">
            Running low: {alerts.map((a) => `${a.name} (${STOCK_BADGE[a.stock_status].text})`).join(", ")}
          </p>
        )}
      </section>

      <section className="card p-4 sm:p-6">
        <ul className="divide-y divide-brown/20">
          {rows.map((r) => {
            const b = STOCK_BADGE[r.stock_status];
            const history = moves.filter((m) => m.ingredient_id === r.id).slice(0, 12);
            return (
              <li key={r.id} className={`py-3 ${r.is_active ? "" : "opacity-60"}`}>
                <details>
                  <summary className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 py-1">
                    <span className="font-semibold">{r.name}</span>
                    <span className={`rounded-full border-[1.5px] border-brown px-2 py-0.5 text-xs font-bold ${b.cls}`}>{b.text}</span>
                    {r.kind === "packaging" && <span className="text-xs uppercase tracking-widest">packaging</span>}
                    <span className="ml-auto text-sm">
                      {r.track_stock ? (
                        <>
                          <strong>{fmtQty(r.available, r.unit)}</strong> available
                          {Number(r.reserved) > 0 && <> · {fmtQty(r.reserved, r.unit)} reserved</>}
                          {r.days_left !== null && <> · ~{Math.max(0, Number(r.days_left))} days</>}
                        </>
                      ) : (
                        "Enter stock to start"
                      )}
                    </span>
                  </summary>

                  <p className="mt-2 text-sm">
                    On hand {fmtQty(r.on_hand, r.unit)} · average cost {fmtUnitCost(r.avg_unit_cost, r.unit)} · uses ~{fmtQty(r.avg_daily_use, r.unit)}/day ·
                    low below {fmtQty(r.low_threshold, r.unit)}
                  </p>

                  <div className="mt-3 grid gap-5 sm:grid-cols-3">
                    <div>
                      <h3 className="font-semibold">Restock</h3>
                      <ActionForm action={restockIngredient.bind(null, r.id)} submitLabel="Add stock" className="mt-2 space-y-2">
                        <label className="block text-sm font-semibold">Amount ({r.unit})
                          <input name="qty" type="number" min="0.001" step="any" required className="field mt-1" />
                        </label>
                        <label className="block text-sm font-semibold">Total price paid (EGP)
                          <input name="total_price" type="number" min="0" step="any" required className="field mt-1" />
                        </label>
                        <label className="block text-sm font-semibold">Note (optional)
                          <input name="note" maxLength={120} placeholder="Supplier, pack size…" className="field mt-1" />
                        </label>
                      </ActionForm>
                    </div>

                    <div>
                      <h3 className="font-semibold">Waste or recount</h3>
                      <ActionForm action={adjustIngredient.bind(null, r.id)} submitLabel="Save" className="mt-2 space-y-2">
                        <label className="block text-sm font-semibold">Type
                          <select name="mode" className="field mt-1" defaultValue="waste">
                            <option value="waste">Waste: subtract this amount</option>
                            <option value="recount">Recount: I counted exactly this much</option>
                          </select>
                        </label>
                        <label className="block text-sm font-semibold">Amount ({r.unit})
                          <input name="amount" type="number" min="0" step="any" required className="field mt-1" />
                        </label>
                        <label className="block text-sm font-semibold">Reason
                          <input name="note" required maxLength={120} placeholder="Spilled, expired, weekly count…" className="field mt-1" />
                        </label>
                      </ActionForm>
                    </div>

                    <div>
                      <h3 className="font-semibold">Details</h3>
                      <ActionForm action={updateIngredient.bind(null, r.id)} submitLabel="Save details" className="mt-2 space-y-2">
                        <IngredientFields r={r} />
                        <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                          <input type="checkbox" name="is_active" defaultChecked={r.is_active} className="size-5 accent-[var(--brown)]" />
                          In use
                        </label>
                      </ActionForm>
                    </div>
                  </div>

                  {history.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-sm font-semibold">Recent history</h3>
                      <ul className="mt-1 text-sm">
                        {history.map((m, i) => (
                          <li key={i} className="flex flex-wrap gap-x-3">
                            <span className="w-36">{cairoDateTime(m.created_at)}</span>
                            <span className={`w-24 font-semibold ${Number(m.change) < 0 ? "" : "text-green-800"}`}>
                              {Number(m.change) > 0 ? "+" : ""}
                              {fmtQty(m.change, r.unit)}
                            </span>
                            <span>{REASON[m.reason] ?? m.reason}{m.note ? ` · ${m.note}` : ""}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="font-serif text-2xl font-bold italic">Add ingredient or packaging</h2>
        <ActionForm action={addIngredient} submitLabel="Add" className="mt-3 grid gap-3 sm:grid-cols-2">
          <IngredientFields />
        </ActionForm>
      </section>
    </div>
  );
}

function IngredientFields({ r }: { r?: Row }) {
  return (
    <>
      <label className="block text-sm font-semibold">Name
        <input name="name" required maxLength={60} defaultValue={r?.name} className="field mt-1" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block text-sm font-semibold">Type
          <select name="kind" defaultValue={r?.kind ?? "ingredient"} className="field mt-1">
            <option value="ingredient">Ingredient</option>
            <option value="packaging">Packaging</option>
          </select>
        </label>
        <label className="block text-sm font-semibold">Unit
          <select name="unit" defaultValue={r?.unit ?? "g"} className="field mt-1">
            <option value="g">grams (g)</option>
            <option value="ml">millilitres (ml)</option>
            <option value="pcs">pieces</option>
          </select>
        </label>
      </div>
      <label className="block text-sm font-semibold">Warn me when below
        <input name="low_threshold" type="number" min="0" step="any" required defaultValue={r ? Number(r.low_threshold) : 0} className="field mt-1" />
      </label>
    </>
  );
}

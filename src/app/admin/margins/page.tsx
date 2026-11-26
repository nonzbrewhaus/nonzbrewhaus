import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { addDays, cairoDay } from "@/lib/cairo";

type Margin = {
  id: string; kind: "item" | "addon"; category: string; name: string; price: number; status: string; sort_order: number;
  recipe_id: string | null; recipe_name: string | null; ingredient_cost: number | null; packaging_cost: number | null;
  overhead_cost: number | null; total_cost: number | null; profit: number | null; margin_pct: number | null; margin_target_pct: number;
};
type Summary = { orders: number; drinks: number; revenue: number; cost: number; items: { name: string; qty: number; revenue: number; cost: number }[] };

const RANGES = [
  { key: "today", label: "Today", days: 0 },
  { key: "7", label: "Last 7 days", days: 6 },
  { key: "30", label: "Last 30 days", days: 29 },
] as const;

const n2 = (v: number | null) => (v === null ? "-" : Number(v).toFixed(2));

export default function MarginsPage({ searchParams }: PageProps<"/admin/margins">) {
  return (
    <Suspense fallback={<p className="card p-6">Loading margins…</p>}>
      <Margins searchParams={searchParams} />
    </Suspense>
  );
}

async function Margins({ searchParams }: { searchParams: PageProps<"/admin/margins">["searchParams"] }) {
  const { supabase } = await requireAdmin();
  const { range: raw } = await searchParams;
  const range = RANGES.find((r) => r.key === raw) ?? RANGES[1];
  const to = cairoDay();
  const from = addDays(to, -range.days);

  const [mRes, sRes] = await Promise.all([
    supabase.from("product_margins").select("*").order("kind").order("sort_order"),
    supabase.rpc("admin_period_summary", { p_from: from, p_to: to }),
  ]);
  if (mRes.error || sRes.error) throw mRes.error ?? sRes.error;
  const rows = mRes.data as Margin[];
  const s = sRes.data as Summary;
  const profit = Number(s.revenue) - Number(s.cost);
  const marginAll = Number(s.revenue) > 0 ? (profit / Number(s.revenue)) * 100 : null;
  const target = rows[0]?.margin_target_pct ?? 60;

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <h1 className="font-serif text-3xl font-bold italic">Margins</h1>
        <nav aria-label="Period" className="mt-3 flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <Link
              key={r.key}
              href={`/admin/margins?range=${r.key}`}
              aria-current={r.key === range.key ? "page" : undefined}
              className={`rounded-full border-[1.5px] border-brown px-3 py-2 text-sm font-semibold ${r.key === range.key ? "bg-brown text-cream" : "bg-cream"}`}
            >
              {r.label}
            </Link>
          ))}
        </nav>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Revenue", `${Number(s.revenue).toFixed(0)} EGP`],
            ["Cost of drinks", `${Number(s.cost).toFixed(0)} EGP`],
            ["Profit", `${profit.toFixed(0)} EGP`],
            ["Margin", marginAll === null ? "-" : `${marginAll.toFixed(1)}%`],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border-[1.5px] border-brown bg-[#FFF8F4] p-3">
              <dt className="text-xs font-semibold tracking-wider">{k.toUpperCase()}</dt>
              <dd className="font-serif text-2xl font-bold italic">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs">
          {s.orders} confirmed orders, {s.drinks} drinks, picked up {from === to ? "today" : `${from} → ${to}`}. Costs are the ones saved when each
          payment was confirmed, so they don&apos;t change if prices change later. The full KPI dashboard comes in the next phase.
        </p>
        {s.items.length > 0 && (
          <p className="mt-2 text-sm">
            <strong>Best seller:</strong> {s.items[0].name} ({s.items[0].qty})
            {s.items.length > 1 && (
              <>
                {" "}· <strong>Slowest:</strong> {s.items[s.items.length - 1].name} ({s.items[s.items.length - 1].qty})
              </>
            )}
          </p>
        )}
      </section>

      <section className="card overflow-x-auto p-4 sm:p-6">
        <h2 className="font-serif text-2xl font-bold italic">Per drink (today&apos;s costs)</h2>
        <p className="text-sm">
          From each active recipe at today&apos;s average ingredient prices. Below the {target}% target is shown in red.{" "}
          <Link className="underline" href="/admin/recipes">Edit recipes</Link> · <Link className="underline" href="/admin/inventory">Update costs (restock)</Link>
        </p>
        <table className="mt-3 w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b-[1.5px] border-brown text-left">
              <th className="py-2 pr-2">Item</th>
              <th className="px-2 text-right">Price</th>
              <th className="px-2 text-right">Ingredients</th>
              <th className="px-2 text-right">Packaging</th>
              <th className="px-2 text-right">Overhead</th>
              <th className="px-2 text-right">Total cost</th>
              <th className="px-2 text-right">Profit</th>
              <th className="pl-2 text-right">Margin</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const low = r.margin_pct !== null && Number(r.margin_pct) < Number(r.margin_target_pct);
              return (
                <tr key={r.id} className="border-b border-brown/15">
                  <td className="py-2 pr-2">
                    <span className="font-semibold">{r.name}</span>
                    {r.kind === "addon" && <span className="ml-1 text-xs uppercase tracking-widest">add-on</span>}
                    {r.status === "paused" && <span className="ml-1 text-xs">(paused)</span>}
                    {!r.recipe_id && <span className="ml-1 text-xs font-bold text-red-800">no recipe</span>}
                  </td>
                  <td className="px-2 text-right">{Number(r.price)}</td>
                  <td className="px-2 text-right">{n2(r.ingredient_cost)}</td>
                  <td className="px-2 text-right">{n2(r.packaging_cost)}</td>
                  <td className="px-2 text-right">{n2(r.overhead_cost)}</td>
                  <td className="px-2 text-right font-semibold">{n2(r.total_cost)}</td>
                  <td className="px-2 text-right">{n2(r.profit)}</td>
                  <td className={`pl-2 text-right font-bold ${low ? "text-red-800" : ""}`}>{r.margin_pct === null ? "-" : `${Number(r.margin_pct).toFixed(1)}%`}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs">Add-on rows show only the extra cost of the add-on (e.g. oat milk minus the regular milk it replaces).</p>
      </section>
    </div>
  );
}

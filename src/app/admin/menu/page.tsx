import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { deleteProduct, saveProduct, setStatus, type Kind } from "./actions";

const TABS = ["active", "paused", "archived"] as const;
type Tab = (typeof TABS)[number];

type Product = {
  id: string;
  name: string;
  price: number;
  sort_order: number;
  status: Tab;
  paused_display: "greyed" | "hidden";
  resume_on: string | null;
  category?: "coffee" | "matcha";
  description?: string;
  is_signature?: boolean;
};

export default function MenuAdminPage({ searchParams }: PageProps<"/admin/menu">) {
  return (
    <Suspense fallback={<p className="card p-6">Loading menu…</p>}>
      <MenuAdmin searchParams={searchParams} />
    </Suspense>
  );
}

async function MenuAdmin({ searchParams }: { searchParams: PageProps<"/admin/menu">["searchParams"] }) {
  const { supabase } = await requireAdmin();
  const { tab: rawTab } = await searchParams;
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "active";

  const [items, addons] = await Promise.all([
    supabase.from("menu_items").select("*").eq("status", tab).order("sort_order"),
    supabase.from("addons").select("*").eq("status", tab).order("sort_order"),
  ]);
  if (items.error || addons.error) throw items.error ?? addons.error;

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <h1 className="font-serif text-3xl font-bold italic">Menu</h1>
        <nav aria-label="Status" className="mt-3 flex gap-2">
          {TABS.map((t) => (
            <Link
              key={t}
              href={`/admin/menu?tab=${t}`}
              aria-current={t === tab ? "page" : undefined}
              className={`rounded-full border-[1.5px] border-brown px-4 py-2 text-sm font-semibold capitalize ${t === tab ? "bg-brown text-cream" : "bg-cream"}`}
            >
              {t}
            </Link>
          ))}
        </nav>
        <p className="mt-3 text-sm">
          {tab === "active" && "Customers can order these."}
          {tab === "paused" && "Hidden or greyed out for now. Set a \"back on\" date and they turn Active automatically."}
          {tab === "archived" && "Removed from the menu for good, but kept for past orders and reports. Restore any time."}
        </p>
      </section>

      <ProductList title="Drinks" kind="item" products={items.data as Product[]} />
      <ProductList title="Add-ons" kind="addon" products={addons.data as Product[]} />

      {tab === "active" && (
        <section className="card p-4 sm:p-6">
          <h2 className="font-serif text-2xl font-bold italic">Add new</h2>
          <p className="text-sm">New items start as Paused so customers don&apos;t see them until you set them Active.</p>
          <div className="mt-4 grid gap-6 sm:grid-cols-2">
            <div>
              <h3 className="font-semibold">Drink</h3>
              <ActionForm action={saveProduct.bind(null, "item", null)} submitLabel="Add drink" className="mt-2 space-y-3">
                <ProductFields kind="item" />
              </ActionForm>
            </div>
            <div>
              <h3 className="font-semibold">Add-on</h3>
              <ActionForm action={saveProduct.bind(null, "addon", null)} submitLabel="Add add-on" className="mt-2 space-y-3">
                <ProductFields kind="addon" />
              </ActionForm>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

function ProductList({ title, kind, products }: { title: string; kind: Kind; products: Product[] }) {
  return (
    <section className="card p-4 sm:p-6">
      <h2 className="font-serif text-2xl font-bold italic">{title}</h2>
      {products.length === 0 && <p className="mt-2 text-sm">Nothing here.</p>}
      <ul className="mt-3 divide-y divide-brown/20">
        {products.map((p) => (
          <li key={p.id} className="py-3">
            <details>
              <summary className="flex cursor-pointer items-baseline gap-2 py-1">
                <span className="font-semibold">
                  {p.is_signature && <span className="text-gold" aria-hidden>✦ </span>}
                  {p.name}
                </span>
                {p.category && <span className="text-xs uppercase tracking-widest">{p.category}</span>}
                <span className="flex-1 border-b border-dotted border-brown/40" aria-hidden />
                <span className="font-semibold">{kind === "addon" ? "+" : ""}{Number(p.price)} EGP</span>
                {p.resume_on && <span className="rounded-full bg-cream px-2 text-xs">back {p.resume_on}</span>}
              </summary>

              <div className="mt-3 grid gap-6 sm:grid-cols-2">
                <ActionForm action={saveProduct.bind(null, kind, p.id)} submitLabel="Save details" className="space-y-3">
                  <ProductFields kind={kind} p={p} />
                </ActionForm>

                <div className="space-y-4">
                  <ActionForm action={setStatus.bind(null, kind, p.id)} submitLabel="Update status" className="space-y-3">
                    <label className="block">
                      <span className="text-sm font-semibold">Status</span>
                      <select name="status" defaultValue={p.status} className="field mt-1">
                        <option value="active">Active: customers can order</option>
                        <option value="paused">Paused: for now</option>
                        <option value="archived">Archived: removed for good</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold">While paused, customers see it</span>
                      <select name="paused_display" defaultValue={p.paused_display} className="field mt-1">
                        <option value="greyed">Greyed out: &quot;Not available today&quot;</option>
                        <option value="hidden">Hidden</option>
                      </select>
                    </label>
                    <label className="block">
                      <span className="text-sm font-semibold">Back on (optional, paused only)</span>
                      <input type="date" name="resume_on" defaultValue={p.resume_on ?? ""} className="field mt-1" />
                    </label>
                  </ActionForm>

                  <ActionForm
                    action={deleteProduct.bind(null, kind, p.id)}
                    submitLabel="Delete"
                    variant="danger"
                    confirm={`Delete "${p.name}" permanently? Items with orders can only be archived.`}
                  />
                </div>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProductFields({ kind, p }: { kind: Kind; p?: Product }) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-semibold">Name</span>
        <input name="name" required maxLength={80} defaultValue={p?.name} className="field mt-1" />
      </label>
      {kind === "item" && (
        <>
          <label className="block">
            <span className="text-sm font-semibold">Category</span>
            <select name="category" defaultValue={p?.category ?? "coffee"} className="field mt-1">
              <option value="coffee">Coffee</option>
              <option value="matcha">Matcha</option>
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Short description (optional)</span>
            <input name="description" maxLength={200} defaultValue={p?.description} className="field mt-1" />
          </label>
        </>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Price (EGP)</span>
          <input name="price" type="number" min={0} step="0.01" required defaultValue={p ? Number(p.price) : undefined} className="field mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Order on menu</span>
          <input name="sort_order" type="number" min={0} max={999} step={1} required defaultValue={p?.sort_order ?? 50} className="field mt-1" />
        </label>
      </div>
      {kind === "item" && (
        <label className="flex min-h-11 items-center gap-2">
          <input name="is_signature" type="checkbox" defaultChecked={p?.is_signature} className="size-5 accent-[var(--brown)]" />
          <span className="text-sm font-semibold">Signature drink ✦</span>
        </label>
      )}
    </>
  );
}

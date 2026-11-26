import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { AdminLive } from "../admin-live";
import { OrderCard, type AdminOrder } from "../order-card";

export default function SearchPage({ searchParams }: PageProps<"/admin/search">) {
  return (
    <Suspense fallback={<p className="card p-6">Searching…</p>}>
      <Results searchParams={searchParams} />
    </Suspense>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/admin/search">["searchParams"] }) {
  const { supabase } = await requireAdmin();
  const { q: raw } = await searchParams;
  const q = typeof raw === "string" ? raw.trim().slice(0, 60) : "";

  if (q.length < 2) {
    return (
      <section className="card p-6">
        <h1 className="font-serif text-3xl font-bold italic">Find an order</h1>
        <p className="mt-2">Type an order number (like <strong>JYJK5YC8</strong> or just the first few letters), a phone number, or a customer&apos;s name in the search box above.</p>
      </section>
    );
  }

  const { data, error } = await supabase.rpc("admin_search_orders", { p_q: q });
  if (error) throw error;
  const orders = data as AdminOrder[];

  const paths = orders.filter((o) => o.status === "payment_submitted" && o.proof).map((o) => o.proof as string);
  const signed = paths.length ? (await supabase.storage.from("payment-proofs").createSignedUrls(paths, 600)).data ?? [] : [];
  const urlFor = (o: AdminOrder) => (o.status === "payment_submitted" ? signed.find((s) => s.path === o.proof)?.signedUrl ?? null : null);

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold italic">Search: “{q}”</h1>
          <AdminLive />
        </div>
        <p className="mt-1 text-sm">
          {orders.length === 0 ? "No matching orders." : `${orders.length}${orders.length === 50 ? "+" : ""} ${orders.length === 1 ? "order" : "orders"}, newest first.`}
        </p>
      </section>

      {orders.map((o) => (
        <div key={o.id}>
          <OrderCard o={o} receiptUrl={urlFor(o)} showDate />
          <Link href={`/o/${o.code}`} target="_blank" className="ml-2 mt-1 inline-block text-xs underline">
            Open the customer&apos;s order page ↗
          </Link>
        </div>
      ))}
    </div>
  );
}

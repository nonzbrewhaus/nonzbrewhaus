import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { AdminLive } from "../admin-live";
import { OrderCard, type AdminOrder } from "../order-card";

export default function PaymentsPage() {
  return (
    <Suspense fallback={<p className="card p-6">Loading payments…</p>}>
      <Payments />
    </Suspense>
  );
}

async function Payments() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc("admin_pending_payments");
  if (error) throw error;
  const orders = data as AdminOrder[];

  // Receipts are private: short-lived links, readable only because the owner is signed in.
  const paths = orders.map((o) => o.proof).filter((p): p is string => !!p);
  const signed = paths.length ? (await supabase.storage.from("payment-proofs").createSignedUrls(paths, 600)).data ?? [] : [];
  const urlFor = (path: string | null) => signed.find((s) => s.path === path)?.signedUrl ?? null;

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold italic">Payments to review</h1>
          <AdminLive />
        </div>
        <p className="mt-1 text-sm">
          Check each receipt against your InstaPay app: the amount and the sender. Confirm to lock in the order, or reject to cancel it.
        </p>
      </section>

      {orders.length === 0 && <p className="card p-6">All caught up. No payments waiting. ✓</p>}
      {orders.map((o) => (
        <OrderCard key={o.id} o={o} receiptUrl={urlFor(o.proof)} showDate />
      ))}
    </div>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { addDays, cairoDateLabel, cairoDay, cairoTime } from "@/lib/cairo";
import { AdminLive } from "./admin-live";
import { OrderCard, holdsSlot, type AdminOrder } from "./order-card";

export default function TodayPage({ searchParams }: PageProps<"/admin">) {
  return (
    <Suspense fallback={<p className="card p-6">Loading orders…</p>}>
      <Board searchParams={searchParams} />
    </Suspense>
  );
}

async function Board({ searchParams }: { searchParams: PageProps<"/admin">["searchParams"] }) {
  const { supabase } = await requireAdmin();
  const sp = await searchParams;
  const today = cairoDay();
  const day = typeof sp.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : today;
  const showAll = sp.all === "1";

  const [dayRes, pendingRes] = await Promise.all([
    supabase.rpc("admin_orders_for_day", { p_day: day }),
    supabase.rpc("admin_pending_payments"),
  ]);
  if (dayRes.error || pendingRes.error) throw dayRes.error ?? pendingRes.error;
  const orders = dayRes.data as AdminOrder[];
  const pendingCount = (pendingRes.data as AdminOrder[]).length;

  const hidden = orders.filter((o) => o.status === "expired" || o.status === "cancelled" || (o.status === "pending_payment" && !holdsSlot(o)));
  const visible = showAll ? orders : orders.filter((o) => !hidden.includes(o));
  const slots = [...new Set(visible.map((o) => o.pickup_at))];
  const active = orders.filter(holdsSlot);
  const revenue = orders.filter((o) => ["confirmed", "ready", "picked_up"].includes(o.status)).reduce((s, o) => s + Number(o.total), 0);

  const dayLink = (d: string, label: string) => (
    <Link
      key={d}
      href={`/admin?date=${d}${showAll ? "&all=1" : ""}`}
      aria-current={d === day ? "page" : undefined}
      className={`rounded-full border-[1.5px] border-brown px-3 py-2 text-sm font-semibold ${d === day ? "bg-brown text-cream" : "bg-cream"}`}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      {pendingCount > 0 && (
        <Link href="/admin/payments" className="card flex items-center justify-between bg-[#BFD7F2] p-4 font-bold">
          <span>{pendingCount} {pendingCount === 1 ? "payment" : "payments"} to review</span>
          <span>Review →</span>
        </Link>
      )}

      <section className="card p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl font-bold italic">{day === today ? "Today" : cairoDateLabel(day)}</h1>
          <AdminLive />
        </div>
        <nav aria-label="Day" className="mt-3 flex flex-wrap items-center gap-2">
          {dayLink(addDays(today, -1), "Yesterday")}
          {dayLink(today, "Today")}
          {dayLink(addDays(today, 1), "Tomorrow")}
          {dayLink(addDays(today, 2), cairoDateLabel(addDays(today, 2)))}
          {dayLink(addDays(today, 3), cairoDateLabel(addDays(today, 3)))}
          <form className="flex items-center gap-2">
            <label className="sr-only" htmlFor="jump-date">Go to date</label>
            <input id="jump-date" type="date" name="date" defaultValue={day} className="field !min-h-10 !w-auto !py-1" />
            <button className="btn btn-secondary !min-h-10 text-sm">Go</button>
          </form>
        </nav>
        <p className="mt-3 text-sm">
          <strong>{active.length}</strong> active orders · <strong>{active.reduce((s, o) => s + o.drinks, 0)}</strong> drinks ·{" "}
          <strong>{revenue}</strong> EGP confirmed
          {hidden.length > 0 && (
            <>
              {" · "}
              <Link className="underline" href={`/admin?date=${day}${showAll ? "" : "&all=1"}`}>
                {showAll ? "Hide" : "Show"} {hidden.length} expired/cancelled
              </Link>
            </>
          )}
        </p>
      </section>

      {slots.length === 0 && <p className="card p-6">No orders for this day yet.</p>}

      {slots.map((slot) => {
        const list = visible.filter((o) => o.pickup_at === slot);
        const holding = list.filter(holdsSlot);
        return (
          <section key={slot} className="card p-4 sm:p-5" aria-label={`Pickup ${cairoTime(slot)}`}>
            <h2 className="flex flex-wrap items-baseline gap-x-3 font-serif text-2xl font-bold italic">
              {cairoTime(slot)}
              <span className="font-sans text-sm font-semibold not-italic">
                {holding.length} {holding.length === 1 ? "order" : "orders"} · {holding.reduce((s, o) => s + o.drinks, 0)} drinks
              </span>
            </h2>
            <div className="mt-3 space-y-3">
              {list.map((o) => (
                <OrderCard key={o.id} o={o} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

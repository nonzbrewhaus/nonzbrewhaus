import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Countdown, CopyButton } from "./order-client";
import { LiveOrder, ProofUpload } from "./proof-upload";

type Order = {
  code: string;
  name: string;
  status: "pending_payment" | "payment_submitted" | "confirmed" | "ready" | "picked_up" | "expired" | "cancelled";
  pickup_at: string;
  expires_at: string;
  total: number;
  drinks: number;
  notes: string;
  items: { name: string; price: number; qty: number; addons: { name: string; price: number }[] }[];
};

const BADGE: Record<Order["status"], { text: string; bg: string }> = {
  pending_payment: { text: "Waiting for payment", bg: "bg-[#F6D58E]" },
  payment_submitted: { text: "Under review", bg: "bg-[#BFD7F2]" },
  confirmed: { text: "Confirmed", bg: "bg-[#BFE3C6]" },
  ready: { text: "Ready for pickup", bg: "bg-rose" },
  picked_up: { text: "Picked up", bg: "bg-[#BFE3C6]" },
  expired: { text: "Expired", bg: "bg-[#E3E0DD]" },
  cancelled: { text: "Cancelled", bg: "bg-[#E3E0DD]" },
};

export default function OrderPage({ params }: PageProps<"/o/[code]">) {
  return (
    <main className="mx-auto w-full max-w-md px-3.5 pb-10 pt-4">
      <Suspense fallback={<p className="card p-6 text-center">Loading your order…</p>}>
        <OrderView params={params} />
      </Suspense>
    </main>
  );
}

async function OrderView({ params }: { params: PageProps<"/o/[code]">["params"] }) {
  const { code } = await params;
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) notFound();

  const supabase = await createClient();
  const [orderRes, settingsRes] = await Promise.all([
    supabase.rpc("get_order", { p_code: code }),
    supabase.rpc("customer_settings").single(),
  ]);
  const order = orderRes.data as Order | null;
  if (!order) notFound();
  const s = (settingsRes.data ?? {}) as { instapay_handle?: string; instapay_link?: string; whatsapp_number?: string };

  const pickup = new Date(order.pickup_at).toLocaleString("en-GB", {
    timeZone: "Africa/Cairo",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const badge = BADGE[order.status];
  // Goes through our own redirect so the shop's number isn't in the page.
  const waLink = s.whatsapp_number ? `/o/${order.code}/whatsapp` : null;

  const live = ["pending_payment", "payment_submitted", "confirmed", "ready"].includes(order.status);

  return (
    <div className="card px-[18px] py-5">
      {live && <LiveOrder code={order.code} />}
      <div className="flex items-baseline justify-between">
        <Link href="/" className="font-serif text-[26px] font-bold italic">Nonzz&apos;s</Link>
        <p className="font-bold tracking-wider">Order #{order.code}</p>
      </div>

      <p role="status" className={`mt-3 inline-flex items-center gap-2 rounded-full border-[1.5px] border-brown px-3.5 py-1.5 font-bold ${badge.bg}`}>
        <span className="size-2.5 rounded-full bg-brown" aria-hidden />
        {badge.text}
      </p>

      {order.status === "pending_payment" && (
        <>
          <p className="mt-3 text-[15px]">
            Hi {order.name}! Pay within <Countdown expiresAt={order.expires_at} /> to keep your slot.
          </p>
          <div className="mt-3.5 rounded-2xl border-[1.5px] border-brown bg-cream p-4">
            <p className="text-[13px] font-semibold tracking-wider">AMOUNT</p>
            <p className="font-serif text-[40px] font-bold italic leading-tight">{Number(order.total)} EGP</p>
            {s.instapay_link && (
              <a
                href={s.instapay_link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-[54px] w-full items-center justify-center rounded-full border-[1.5px] border-brown bg-brown text-[17px] font-bold text-cream shadow-[3px_3px_0_#E46C88]"
              >
                Pay with InstaPay ↗
              </a>
            )}
            {s.instapay_handle && (
              <div className="mt-3 flex items-center gap-2 text-sm">
                <span className="flex-1">
                  {s.instapay_link ? "or send to " : "Send to "}
                  <strong>{s.instapay_handle}</strong>
                </span>
                <CopyButton text={s.instapay_handle} />
              </div>
            )}
            {!s.instapay_link && !s.instapay_handle && <p className="mt-2 text-sm">Payment details are coming soon. Please message us on WhatsApp.</p>}
          </div>
          <ProofUpload code={order.code} />
          <p className="mt-1.5 text-center text-xs">Step 2: after paying, upload the InstaPay receipt so we can confirm your order.</p>
        </>
      )}

      {order.status === "payment_submitted" && (
        <>
          <p className="mt-3">
            <strong>Receipt received ✓</strong> We&apos;re checking your payment. This page updates by itself, no need to refresh.
          </p>
          <ProofUpload code={order.code} again />
        </>
      )}
      {order.status === "confirmed" && <p className="mt-3 font-serif text-[26px] font-bold italic">Payment confirmed. See you {pickup}!</p>}
      {order.status === "ready" && <p className="mt-3 font-serif text-[26px] font-bold italic">Your drinks are ready. Come pick them up!</p>}
      {order.status === "picked_up" && <p className="mt-3">Enjoy your coffee, and thank you! ♥</p>}
      {order.status === "cancelled" && <p className="mt-3">This order was cancelled. Message us on WhatsApp if that&apos;s unexpected.</p>}
      {order.status === "expired" && (
        <div className="mt-3">
          <p>Time ran out before payment arrived, so your slot was released.</p>
          <Link href="/" className="btn btn-primary mt-2.5 inline-flex items-center">Order again</Link>
        </div>
      )}

      <div className="mt-[18px] border-t-[1.5px] border-brown pt-2.5 text-sm">
        <ul>
          {order.items.map((it, i) => (
            <li key={i} className="flex justify-between gap-2 py-1">
              <span>
                <strong>{it.qty}× {it.name}</strong>
                {it.addons.map((a, j) => (
                  <span key={j} className="block text-[13px]">+ {a.name}</span>
                ))}
              </span>
              <span className="font-bold">{(Number(it.price) + it.addons.reduce((x, a) => x + Number(a.price), 0)) * it.qty}</span>
            </li>
          ))}
        </ul>
        {order.notes && <p className="mt-1 text-[13px]">Notes: {order.notes}</p>}
        <p className="mt-2 flex justify-between"><span>Pickup</span><strong>{pickup}</strong></p>
        <p className="mt-1 flex justify-between"><span>Total</span><strong>{Number(order.total)} EGP</strong></p>
      </div>

      {waLink && (
        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-secondary mt-3.5 flex w-full items-center justify-center">
          Message us on WhatsApp
        </a>
      )}
      <p className="mt-3 text-center text-xs">Bookmark this page to check your order later.</p>
    </div>
  );
}

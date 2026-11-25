import { ActionForm } from "@/components/action-form";
import { cairoDateTime, cairoTime } from "@/lib/cairo";
import { cancelOrder, confirmPayment, markPickedUp, markReady, rejectPayment } from "./orders-actions";

export type AdminOrder = {
  id: string;
  code: string;
  name: string;
  phone: string;
  status: "pending_payment" | "payment_submitted" | "confirmed" | "ready" | "picked_up" | "expired" | "cancelled";
  pickup_at: string;
  expires_at: string;
  total: number;
  drinks: number;
  notes: string;
  proof: string | null;
  created_at: string;
  items: { name: string; qty: number; price: number; addons: string[] }[];
};

export const STATUS: Record<AdminOrder["status"], { text: string; bg: string }> = {
  pending_payment: { text: "Waiting for payment", bg: "bg-[#F6D58E]" },
  payment_submitted: { text: "Review payment", bg: "bg-[#BFD7F2]" },
  confirmed: { text: "Confirmed", bg: "bg-[#BFE3C6]" },
  ready: { text: "Ready", bg: "bg-rose" },
  picked_up: { text: "Picked up", bg: "bg-[#E3E0DD]" },
  expired: { text: "Expired", bg: "bg-[#E3E0DD]" },
  cancelled: { text: "Cancelled", bg: "bg-[#E3E0DD]" },
};

/** Orders that take up a slot (same rule as the database). */
export function holdsSlot(o: AdminOrder) {
  return ["payment_submitted", "confirmed", "ready", "picked_up"].includes(o.status) || (o.status === "pending_payment" && new Date(o.expires_at) > new Date());
}

export function OrderCard({ o, receiptUrl, showDate = false }: { o: AdminOrder; receiptUrl?: string | null; showDate?: boolean }) {
  const s = STATUS[o.status];
  const done = ["picked_up", "expired", "cancelled"].includes(o.status);
  const wa = `https://wa.me/${o.phone.replace(/\D/g, "")}?text=${encodeURIComponent(`Hi ${o.name}! About your Nonzz's order ${o.code}`)}`;

  return (
    <article className={`rounded-2xl border-[1.5px] border-brown bg-[#FFF8F4] p-3.5 ${done ? "opacity-60" : ""}`} aria-label={`Order ${o.code} from ${o.name}`}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-bold">#{o.code}</span>
        <span className="font-semibold">{o.name}</span>
        <span className={`rounded-full border-[1.5px] border-brown px-2.5 py-0.5 text-xs font-bold ${s.bg}`}>{s.text}</span>
        {showDate && <span className="text-sm">Pickup {cairoDateTime(o.pickup_at)}</span>}
        <span className="ml-auto font-bold">{Number(o.total)} EGP</span>
      </div>

      <ul className="mt-2 text-sm">
        {o.items.map((it, i) => (
          <li key={i}>
            <strong>{it.qty}×</strong> {it.name}
            {it.addons.length > 0 && <span> + {it.addons.join(", ")}</span>}
          </li>
        ))}
      </ul>
      {o.notes && <p className="mt-1 text-sm"><strong>Notes:</strong> {o.notes}</p>}
      {o.status === "pending_payment" && (
        <p className="mt-1 text-xs">Hold ends {cairoTime(o.expires_at)} · ordered {cairoTime(o.created_at)}</p>
      )}

      {receiptUrl && (
        <a href={receiptUrl} target="_blank" rel="noopener noreferrer" className="mt-3 block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from private storage */}
          <img src={receiptUrl} alt={`Payment receipt for order ${o.code}`} className="max-h-72 rounded-lg border-[1.5px] border-brown object-contain" />
          <span className="mt-1 block text-xs underline">Open full size</span>
        </a>
      )}

      <div className="mt-3 flex flex-wrap items-start gap-2">
        {o.status === "payment_submitted" && (
          <>
            <ActionForm action={confirmPayment.bind(null, o.id)} submitLabel={`Confirm ${Number(o.total)} EGP received`} />
            <ActionForm
              action={rejectPayment.bind(null, o.id)}
              submitLabel="Reject"
              variant="danger"
              confirm={`Reject the payment and cancel order ${o.code}? Message ${o.name} on WhatsApp to explain.`}
            />
          </>
        )}
        {o.status === "confirmed" && <ActionForm action={markReady.bind(null, o.id)} submitLabel="Mark ready" />}
        {(o.status === "confirmed" || o.status === "ready") && (
          <ActionForm action={markPickedUp.bind(null, o.id)} submitLabel="Picked up" variant={o.status === "ready" ? "primary" : "secondary"} />
        )}
        <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary inline-flex items-center">
          WhatsApp {o.phone.replace("+20", "0")}
        </a>
        {!done && o.status !== "payment_submitted" && (
          <ActionForm
            action={cancelOrder.bind(null, o.id)}
            submitLabel="Cancel"
            variant="danger"
            confirm={`Cancel order ${o.code} for ${o.name}? This frees the slot.`}
          />
        )}
      </div>
    </article>
  );
}

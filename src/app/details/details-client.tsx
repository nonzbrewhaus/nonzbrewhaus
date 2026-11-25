"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { BasketBar, barButtonOff, barButtonOn } from "@/components/basket-bar";
import { cartTotals, normalizeEgPhone, unitPrice } from "@/lib/booking";
import { cart, useCart } from "@/lib/cart-store";
import { placeOrder } from "./actions";

const CUSTOMER_KEY = "nz-customer-v1";

function savedCustomer(): { name: string; phone: string } {
  if (typeof window === "undefined") return { name: "", phone: "" };
  try {
    const s = JSON.parse(localStorage.getItem(CUSTOMER_KEY) ?? "null");
    return { name: typeof s?.name === "string" ? s.name : "", phone: typeof s?.phone === "string" ? s.phone : "" };
  } catch {
    return { name: "", phone: "" };
  }
}

export function DetailsClient() {
  const router = useRouter();
  const { lines, slot } = useCart();
  const { drinks, total } = cartTotals(lines);
  // Returning customers: name + phone remembered on this device only. (Inputs only render after
  // the cart loads on the client, so reading localStorage here can't cause a hydration mismatch.)
  const [name, setName] = useState(() => savedCustomer().name);
  const [phone, setPhone] = useState(() => savedCustomer().phone);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<{ text: string; slotProblem?: boolean } | null>(null);
  const [touched, setTouched] = useState(false);
  const [pending, startTransition] = useTransition();
  const [placed, setPlaced] = useState<string | null>(null);

  const phoneOk = normalizeEgPhone(phone) !== null;
  const ready = name.trim().length > 0 && phoneOk && drinks > 0 && !!slot;

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    setTouched(true);
    if (!ready || pending || !slot) return;
    setError(null);
    startTransition(async () => {
      const res = await placeOrder({
        name: name.trim(),
        phone,
        notes: notes.trim(),
        pickupAt: slot.pickupAt,
        items: lines.map((l) => ({ itemId: l.itemId, qty: l.qty, addonIds: l.addons.map((a) => a.id) })),
      });
      if (res.ok) {
        try {
          localStorage.setItem(CUSTOMER_KEY, JSON.stringify({ name: name.trim(), phone }));
        } catch {}
        setPlaced(res.code);
        router.push(`/o/${res.code}`);
        cart.clear();
      } else {
        if (res.slotProblem) cart.setSlot(null);
        setError({ text: res.error, slotProblem: res.slotProblem });
      }
    });
  }

  if (placed) {
    return <p className="card p-6 text-center font-semibold">Order placed! Opening your order…</p>;
  }

  if (!drinks || !slot) {
    return (
      <div className="card p-6 text-center">
        <p className="font-serif text-2xl font-bold italic">{drinks ? "Pick a pickup time first" : "Your basket is empty"}</p>
        <Link href={drinks ? "/time" : "/"} className="btn btn-primary mt-4 inline-flex items-center">
          {drinks ? "Choose a time" : "Back to the menu"}
        </Link>
      </div>
    );
  }

  return (
    <>
      <form id="details-form" onSubmit={submit} noValidate className="card px-[18px] pb-5 pt-4">
        <Link href="/time" className="inline-flex min-h-11 items-center text-[15px] font-bold">← Back</Link>
        <h1 className="mb-3 font-serif text-[34px] font-bold italic">Your details</h1>

        <label className="block text-[13px] font-bold">
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" maxLength={80} required className="field mt-1 text-base" />
        </label>
        {touched && !name.trim() && <p className="mt-1 text-sm font-semibold text-red-800">Please enter your name.</p>}

        <label className="mt-2.5 block text-[13px] font-bold">
          Phone (WhatsApp)
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            type="tel"
            inputMode="tel"
            placeholder="01xxxxxxxxx"
            autoComplete="tel"
            required
            aria-invalid={touched && !phoneOk}
            className="field mt-1 text-base"
          />
        </label>
        {touched && !phoneOk && <p className="mt-1 text-sm font-semibold text-red-800">Enter an Egyptian mobile number, like 01xxxxxxxxx.</p>}

        <label className="mt-2.5 block text-[13px] font-bold">
          Notes (optional)
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Less ice, extra sweet…"
            className="field mt-1 resize-none text-base"
          />
        </label>

        <div className="mt-4 border-t-[1.5px] border-brown pt-2.5">
          <ul>
            {lines.map((l) => (
              <li key={l.key} className="flex items-start gap-2 py-1.5">
                <div className="flex-1">
                  <p className="font-bold">{l.qty}× {l.name}</p>
                  {l.addons.map((a) => (
                    <p key={a.id} className="text-[13px]">+ {a.name} ({a.price})</p>
                  ))}
                </div>
                <span className="font-bold">{unitPrice(l) * l.qty}</span>
                <button
                  type="button"
                  onClick={() => cart.removeOne(l.key)}
                  aria-label={`Remove one ${l.name}`}
                  className="-mt-2.5 size-11 text-[22px] font-bold"
                >
                  −
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 flex justify-between text-sm"><span>Pickup</span><span className="font-bold">{slot.label}</span></p>
          <p className="mt-1.5 flex justify-between text-lg font-bold"><span>Total</span><span>{total} EGP</span></p>
          <p className="mt-2.5 text-xs">You&apos;ll pay by InstaPay on the next screen. We hold your slot while you pay.</p>
        </div>

        {error && (
          <div role="alert" className="mt-4 rounded-xl border-[1.5px] border-brown bg-cream p-3 text-sm font-semibold">
            {error.text}{" "}
            {error.slotProblem && <Link href="/time" className="underline">Choose another time</Link>}
          </div>
        )}
      </form>

      <BasketBar
        title={`${total} EGP`}
        sub={ready ? "Ready to place" : "Add your name and phone"}
        action={
          <button type="submit" form="details-form" disabled={pending} className={ready && !pending ? barButtonOn : barButtonOff.replace("pointer-events-none ", "")}>
            {pending ? "Placing…" : "Place order"}
          </button>
        }
      />
    </>
  );
}

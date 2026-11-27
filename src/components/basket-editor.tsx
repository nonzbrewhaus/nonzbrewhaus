"use client";

import { MAX_LINE_QTY, MAX_NOTE, cartTotals, unitPrice } from "@/lib/booking";
import { cart, useCart } from "@/lib/cart-store";

/**
 * Edit the basket: − / + per drink, remove, and a note per drink.
 * Used in the "Your basket" sheet and on the details page.
 * Note: drinks only stay as separate lines if they differ in add-ons; a note applies to the whole line.
 */
export function BasketEditor({ compact = false }: { compact?: boolean }) {
  const { lines } = useCart();
  const { drinks, total } = cartTotals(lines);

  if (!lines.length) return <p className="py-2 text-sm">Your basket is empty.</p>;

  return (
    <div>
      <ul className="divide-y divide-brown/20">
        {lines.map((l) => {
          const price = unitPrice(l);
          return (
            <li key={l.key} className="py-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{l.name}</p>
                  {l.addons.map((a) => (
                    <p key={a.id} className="text-[13px]">+ {a.name} ({a.price})</p>
                  ))}
                  <p className="text-[13px]">{price} EGP each</p>
                </div>
                <span className="pt-0.5 font-bold">{price * l.qty} EGP</span>
              </div>

              <div className="mt-2 flex items-center gap-2">
                <div className="flex items-center rounded-full border-[1.5px] border-brown bg-[#FFF8F4]" role="group" aria-label={`Quantity of ${l.name}`}>
                  <button
                    type="button"
                    onClick={() => cart.setQty(l.key, l.qty - 1)}
                    aria-label={l.qty === 1 ? `Remove ${l.name}` : `One less ${l.name}`}
                    className="size-11 text-xl font-bold"
                  >
                    −
                  </button>
                  <span className="min-w-6 text-center font-bold" aria-live="polite">{l.qty}</span>
                  <button
                    type="button"
                    onClick={() => cart.setQty(l.key, l.qty + 1)}
                    disabled={l.qty >= MAX_LINE_QTY}
                    aria-label={`One more ${l.name}`}
                    className="size-11 text-xl font-bold disabled:opacity-40"
                  >
                    +
                  </button>
                </div>
                <button type="button" onClick={() => cart.removeLine(l.key)} className="ml-auto min-h-11 px-2 text-sm font-semibold underline">
                  Remove
                </button>
              </div>

              <label className="mt-2 block text-[13px] font-semibold">
                Note for {l.qty > 1 ? `these ${l.qty} drinks` : "this drink"} (optional)
                <input
                  value={l.note ?? ""}
                  onChange={(e) => cart.setNote(l.key, e.target.value)}
                  maxLength={MAX_NOTE}
                  placeholder="Less ice, extra sweet…"
                  className="field mt-1 !min-h-10 !py-1 text-base"
                />
              </label>
            </li>
          );
        })}
      </ul>
      {!compact && (
        <p className="mt-2 flex justify-between border-t-[1.5px] border-brown pt-2 text-lg font-bold">
          <span>{drinks} {drinks === 1 ? "drink" : "drinks"}</span>
          <span>{total} EGP</span>
        </p>
      )}
    </div>
  );
}

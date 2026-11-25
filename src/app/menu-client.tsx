"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { BasketBar, barButtonOff, barButtonOn } from "@/components/basket-bar";
import { cartTotals, type Addon, type Category } from "@/lib/booking";
import { cart, useCart } from "@/lib/cart-store";
import { flyToBasket } from "@/lib/fly-to-basket";

export type MenuItem = {
  id: string;
  category: Category;
  name: string;
  description: string;
  price: number;
  is_signature: boolean;
  available: boolean;
};

const CATEGORIES: { key: Category; title: string; cup: string }[] = [
  { key: "coffee", title: "Coffee", cup: "#8A5A3B" },
  { key: "matcha", title: "Matcha", cup: "#9CC08A" },
];

export function MenuClient({ items, addons }: { items: MenuItem[]; addons: Addon[] }) {
  const { lines } = useCart();
  const { drinks } = cartTotals(lines);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fromRect = useRef<DOMRect | null>(null);
  const [open, setOpen] = useState<MenuItem | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [announce, setAnnounce] = useState("");

  // Keep the saved basket in step with the live menu: fresh prices, drop anything no longer sold.
  useEffect(() => {
    const live = new Map(items.filter((i) => i.available).map((i) => [i.id, i]));
    const liveAddons = new Map(addons.map((a) => [a.id, a]));
    const synced = lines
      .filter((l) => live.has(l.itemId) && l.addons.every((a) => liveAddons.has(a.id)))
      .map((l) => ({ ...l, name: live.get(l.itemId)!.name, price: live.get(l.itemId)!.price, addons: l.addons.map((a) => liveAddons.get(a.id)!) }));
    if (JSON.stringify(synced) !== JSON.stringify(lines)) cart.replaceLines(synced);
    // Run once per menu load; `lines` changes are our own writes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, addons]);

  const countFor = (id: string) => lines.filter((l) => l.itemId === id).reduce((s, l) => s + l.qty, 0);

  function openSheet(item: MenuItem, button: HTMLButtonElement) {
    fromRect.current = button.getBoundingClientRect();
    setOpen(item);
    setPicked(new Set());
    dialogRef.current?.showModal();
  }

  function dropInBasket() {
    if (!open) return;
    const chosen = addons.filter((a) => picked.has(a.id));
    cart.add({ itemId: open.id, name: open.name, category: open.category, price: open.price, addons: chosen });
    dialogRef.current?.close();
    flyToBasket(fromRect.current, { matcha: open.category === "matcha", foam: chosen.length > 0 });
    setAnnounce(`${open.name} added to your basket.`);
  }

  const sheetTotal = open ? open.price + addons.filter((a) => picked.has(a.id)).reduce((s, a) => s + a.price, 0) : 0;

  return (
    <>
      {CATEGORIES.map((cat) => {
        const list = items.filter((i) => i.category === cat.key);
        if (!list.length) return null;
        return (
          <section key={cat.key} aria-labelledby={`cat-${cat.key}`}>
            <h2 id={`cat-${cat.key}`} className="mb-2 mt-6 flex items-center gap-2.5 font-serif text-[28px] font-bold italic">
              <svg width="22" height="28" viewBox="0 0 22 28" aria-hidden="true">
                <path d="M3 7h16l-2 19H5z" fill={cat.cup} stroke="#3A2218" strokeWidth="1.6" strokeLinejoin="round" />
                <path d="M2 5h18v3H2z" fill="#F0E4DA" stroke="#3A2218" strokeWidth="1.6" />
                <path d="M12 5l2-4" stroke="#3A2218" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
              {cat.title}
            </h2>
            <ul>
              {list.map((item) => {
                const n = countFor(item.id);
                return (
                  <li key={item.id} className={`flex items-center gap-2 py-2 ${item.available ? "" : "opacity-60"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className={`truncate text-[15px] ${item.is_signature ? "font-bold" : "font-medium"}`}>
                          {item.is_signature && <span className="text-[#B07D1E]" aria-hidden>✦ </span>}
                          {item.name}
                        </span>
                        <span className="min-w-2.5 flex-1 border-b-[1.5px] border-dotted border-brown/45" aria-hidden />
                        <span className="font-bold">{Number(item.price)}</span>
                      </div>
                      {item.description && <p className="text-xs">{item.description}</p>}
                      {!item.available && <p className="text-xs font-semibold">Not available today</p>}
                    </div>
                    {item.available && (
                      <button
                        type="button"
                        onClick={(e) => openSheet(item, e.currentTarget)}
                        aria-label={`Add ${item.name}${n ? `, ${n} in basket` : ""}`}
                        className={`min-h-11 min-w-16 rounded-full border-[1.5px] border-brown px-3 text-sm font-bold shadow-[2px_2px_0_#3A2218] ${n ? "bg-brown text-cream" : "bg-cream"}`}
                      >
                        {n ? `${n} · Add` : "Add"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p aria-live="polite" className="sr-only">{announce}</p>

      <dialog
        ref={dialogRef}
        onClose={() => setOpen(null)}
        aria-label={open ? `Add ${open.name}` : "Add drink"}
        className="mb-0 mt-auto w-full max-w-md rounded-t-3xl border-t-[1.5px] border-brown bg-pink p-0 text-brown sm:mx-auto"
      >
        {open && (
          <div className="px-[18px] pb-7 pt-[18px]">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-serif text-[26px] font-bold italic">{open.name}</h2>
              <span className="font-bold">{Number(open.price)} EGP</span>
            </div>
            {addons.length > 0 && (
              <fieldset className="mt-3.5">
                <legend className="mb-1.5 text-[13px] font-bold tracking-wider">ADD-ONS (OPTIONAL)</legend>
                {addons.map((a) => (
                  <label
                    key={a.id}
                    className={`mb-2 flex min-h-[50px] cursor-pointer items-center gap-3 rounded-[14px] border-[1.5px] border-brown px-3.5 text-[15px] ${picked.has(a.id) ? "bg-cream" : "bg-[#FFF8F4]"}`}
                  >
                    <input
                      type="checkbox"
                      checked={picked.has(a.id)}
                      onChange={(e) => {
                        const next = new Set(picked);
                        if (e.target.checked) next.add(a.id);
                        else next.delete(a.id);
                        setPicked(next);
                      }}
                      className="size-5 accent-[var(--brown)]"
                    />
                    <span className="flex-1 font-semibold">{a.name}</span>
                    <span className="font-bold">+{Number(a.price)}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <button
              type="button"
              onClick={dropInBasket}
              className="mt-2 min-h-[54px] w-full rounded-full border-[1.5px] border-brown bg-brown text-[17px] font-bold text-cream shadow-[3px_3px_0_#E46C88]"
            >
              Drop in basket · {sheetTotal} EGP
            </button>
            <button type="button" onClick={() => dialogRef.current?.close()} className="mt-2 min-h-11 w-full font-semibold underline">
              Cancel
            </button>
          </div>
        )}
      </dialog>

      <BasketBar
        action={
          <Link href="/time" aria-disabled={drinks === 0} tabIndex={drinks === 0 ? -1 : undefined} className={drinks ? barButtonOn : barButtonOff}>
            Pick time →
          </Link>
        }
      />
    </>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { cartTotals } from "@/lib/booking";
import { useCart } from "@/lib/cart-store";
import { BUMP_EVENT } from "@/lib/fly-to-basket";

/** Sticky bottom bar: basket (the animation target), a summary line, and the page's next step. */
export function BasketBar({ title, sub, action }: { title?: string; sub?: string; action: React.ReactNode }) {
  const { lines } = useCart();
  const { drinks, total } = cartTotals(lines);
  const basketRef = useRef<HTMLDivElement>(null);
  const [hearts, setHearts] = useState<number[]>([]);

  useEffect(() => {
    const onBump = () => {
      if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        basketRef.current?.animate(
          [{ transform: "scale(1,1)" }, { transform: "scale(1.18,.82)" }, { transform: "scale(.94,1.08)" }, { transform: "scale(1,1)" }],
          { duration: 260, easing: "ease-out" },
        );
        const id = Date.now();
        setHearts((h) => [...h, id]);
        setTimeout(() => setHearts((h) => h.filter((x) => x !== id)), 700);
      }
    };
    window.addEventListener(BUMP_EVENT, onBump);
    return () => window.removeEventListener(BUMP_EVENT, onBump);
  }, []);

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-md items-center gap-3 rounded-[22px] bg-brown py-2.5 pl-3.5 pr-2.5 text-cream shadow-[0_6px_0_rgba(58,34,24,.25)]">
        <div ref={basketRef} id="basket" className="relative flex size-11 flex-none items-center justify-center rounded-full bg-pink">
          <svg width="26" height="24" viewBox="0 0 26 24" aria-hidden="true">
            <path d="M2 9h22l-3 13H5z" fill="#F0E4DA" stroke="#3A2218" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="M7 9l4-7M19 9l-4-7" stroke="#3A2218" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M9 13v5M13 13v5M17 13v5" stroke="#3A2218" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span className="absolute -right-1.5 -top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-full border-[1.5px] border-brown bg-rose px-1 text-xs font-bold text-brown">
            {drinks}
          </span>
          {hearts.map((id) => (
            <svg key={id} className="heart-pop absolute left-3.5 -top-1.5" width="16" height="15" viewBox="0 0 16 15" aria-hidden="true">
              <path d="M8 14S1 9.6 1 5a3.5 3.5 0 0 1 7-1 3.5 3.5 0 0 1 7 1c0 4.6-7 9-7 9z" fill="#E46C88" stroke="#3A2218" strokeWidth="1.2" />
            </svg>
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-bold">
            {title ?? (drinks ? `${drinks} ${drinks === 1 ? "drink" : "drinks"} · ${total} EGP` : "Your basket is empty")}
          </p>
          <p className="truncate text-xs opacity-90">{sub ?? (drinks ? "Tap Add to drop more in" : "Tap Add on any drink")}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

/** Pill button style used for the bar's next step (Link or button). */
export const barButton =
  "inline-flex min-h-12 items-center rounded-full border-[1.5px] border-cream px-[18px] text-[15px] font-bold text-brown";
export const barButtonOn = `${barButton} bg-pink`;
export const barButtonOff = `${barButton} pointer-events-none bg-[#9C8A82]`;

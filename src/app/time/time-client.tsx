"use client";

import Link from "next/link";
import { useState } from "react";
import { BasketBar, barButtonOff, barButtonOn } from "@/components/basket-bar";
import { cartTotals, dayLabel, formatSlotTime } from "@/lib/booking";
import { cart, useCart } from "@/lib/cart-store";

export type Slot = {
  pickup_at: string;
  day: string;
  shift: "morning" | "evening";
  start_time: string;
  end_time: string;
  orders_left: number;
  drinks_left: number;
  max_orders: number;
  max_drinks: number;
};

const SHIFTS = [
  { key: "morning", title: "Morning" },
  { key: "evening", title: "Evening" },
] as const;

export function TimeClient({ slots, today }: { slots: Slot[]; today: string }) {
  const { lines, slot: chosen } = useCart();
  const { drinks, total } = cartTotals(lines);
  const days = [...new Set(slots.map((s) => s.day))];
  const fits = (s: Slot) => s.orders_left > 0 && s.drinks_left >= Math.max(drinks, 1);
  const firstOpenDay = days.find((d) => slots.some((s) => s.day === d && fits(s))) ?? days[0];
  const [day, setDay] = useState(slots.find((s) => s.pickup_at === chosen?.pickupAt)?.day ?? firstOpenDay);

  // A saved choice that is gone or no longer fits doesn't count.
  const chosenSlot = slots.find((s) => s.pickup_at === chosen?.pickupAt && fits(s));
  const chosenLabel = chosenSlot ? labelFor(chosenSlot, today) : null;

  if (!drinks) {
    return (
      <div className="card p-6 text-center">
        <p className="font-serif text-2xl font-bold italic">Your basket is empty</p>
        <Link href="/" className="btn btn-primary mt-4 inline-flex items-center">Back to the menu</Link>
      </div>
    );
  }

  return (
    <>
      <Link href="/" className="inline-flex min-h-11 items-center px-1 text-[15px] font-bold">← Back to menu</Link>
      <h1 className="-mt-1 mb-1.5 text-center font-script text-[54px] leading-tight">Pickup slots</h1>

      {days.length === 0 ? (
        <p className="card p-6 text-center">No pickup times are open in the next few days. Please check back soon.</p>
      ) : (
        <>
          <div role="group" aria-label="Pickup day" className="flex justify-center gap-2">
            {days.map((d) => {
              const { label, sub } = dayLabel(d, today);
              const on = d === day;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDay(d)}
                  className={`min-h-12 flex-1 rounded-full border-[1.5px] border-brown text-sm font-bold leading-tight shadow-[2px_2px_0_#3A2218] ${on ? "bg-brown text-cream" : "bg-cream"}`}
                >
                  {label}
                  <br />
                  <span className="text-xs font-medium">{sub}</span>
                </button>
              );
            })}
          </div>

          {SHIFTS.map((shift) => {
            const list = slots.filter((s) => s.day === day && s.shift === shift.key);
            if (!list.length) return null;
            const range = formatSlotTime(list[0].start_time, list[list.length - 1].end_time);
            return (
              <section key={shift.key} aria-label={shift.title}>
                <div className="mt-4 flex items-baseline justify-between rounded-full border-[1.5px] border-brown bg-cream px-4 py-1.5">
                  <h2 className="font-serif text-[22px] font-bold italic">{shift.title}</h2>
                  <span className="text-xs font-semibold tracking-widest">{range}</span>
                </div>
                <div className="mt-2.5 grid grid-cols-2 gap-2.5">
                  {list.map((s) => {
                    const full = s.orders_left === 0 || s.drinks_left === 0;
                    const tooSmall = !full && s.drinks_left < drinks;
                    const disabled = full || tooSmall;
                    const selected = s.pickup_at === chosenSlot?.pickup_at;
                    const caption = full ? "FULL" : tooSmall ? `Only ${s.drinks_left} drinks left` : `${s.orders_left} of ${s.max_orders} left`;
                    const time = formatSlotTime(s.start_time, s.end_time);
                    return (
                      <button
                        key={s.pickup_at}
                        type="button"
                        disabled={disabled}
                        aria-pressed={selected}
                        aria-label={`${time}, ${caption}`}
                        onClick={() => cart.setSlot({ pickupAt: s.pickup_at, label: labelFor(s, today) })}
                        className={`min-h-[92px] rounded-[14px] border-[1.5px] border-brown p-3 text-left shadow-[3px_3px_0_#3A2218] ${
                          selected ? "bg-brown text-cream" : disabled ? "bg-muted opacity-80" : "bg-pink"
                        }`}
                      >
                        <span className="block text-[15px] font-bold">{time}</span>
                        <span className="my-2 flex gap-[5px]" aria-hidden>
                          {Array.from({ length: s.max_orders }, (_, i) => {
                            const openDot = !full && i < s.orders_left;
                            return (
                              <span
                                key={i}
                                className={`size-[13px] rounded-full border-[1.5px] ${
                                  openDot ? (selected ? "border-cream bg-cream" : "border-brown bg-brown") : "border-[#B4506A]"
                                }`}
                              />
                            );
                          })}
                        </span>
                        <span className="block text-xs font-semibold">{caption}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            );
          })}

          <p className="mt-3.5 flex gap-4 text-xs font-semibold" aria-hidden>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full bg-brown" />Open spot</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded-full border-[1.5px] border-[#B4506A]" />Booked</span>
          </p>
        </>
      )}

      <BasketBar
        title={chosenLabel ? cap(chosenLabel) : "Pick a pickup slot"}
        sub={`${drinks} ${drinks === 1 ? "drink" : "drinks"} · ${total} EGP`}
        action={
          <Link href="/details" aria-disabled={!chosenSlot} tabIndex={chosenSlot ? undefined : -1} className={chosenSlot ? barButtonOn : barButtonOff}>
            Next →
          </Link>
        }
      />
    </>
  );
}

function labelFor(s: Slot, today: string) {
  const { label, sub } = dayLabel(s.day, today);
  const dayText = label === "Today" || label === "Tomorrow" ? label.toLowerCase() : `${label} ${sub}`;
  return `${dayText}, ${formatSlotTime(s.start_time, s.end_time)}`;
}

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

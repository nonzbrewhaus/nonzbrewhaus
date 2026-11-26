"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { readRecentOrders } from "@/lib/recent-orders";

/** Orders placed on this device, so customers don't need to remember the number. */
export function RecentOrders() {
  const orders = useSyncExternalStore(
    () => () => {},
    readRecentOrders,
    () => EMPTY,
  );
  if (!orders.length) return null;
  return (
    <div className="mt-6 border-t-[1.5px] border-brown pt-3">
      <h2 className="text-sm font-bold tracking-wider">YOUR RECENT ORDERS ON THIS PHONE</h2>
      <ul className="mt-2 space-y-2">
        {orders.map((o) => (
          <li key={o.code}>
            <Link href={`/o/${o.code}`} className="flex min-h-11 items-center justify-between rounded-xl border-[1.5px] border-brown bg-[#FFF8F4] px-3.5">
              <span className="font-bold tracking-wider">#{o.code}</span>
              <span className="text-sm">{o.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

const EMPTY: ReturnType<typeof readRecentOrders> = [];

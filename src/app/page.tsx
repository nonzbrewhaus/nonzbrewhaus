import { Suspense } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MenuClient, type MenuItem } from "./menu-client";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md px-3.5 pb-32 pt-4">
      <div className="card px-5 pb-[18px] pt-[22px]">
        <header className="text-center">
          <p className="font-serif text-[34px] font-bold italic leading-none tracking-wide">Nonzz&apos;s</p>
          <p className="mt-1 text-[11px] tracking-[0.3em]">BREW HAUS</p>
          <h1 className="mt-2.5 font-serif text-5xl font-bold italic leading-tight">Menu</h1>
          <p className="font-script text-2xl">Pick up, sip, repeat.</p>
          <Link
            href="/track"
            className="mt-3 inline-flex min-h-11 items-center rounded-full border-[1.5px] border-brown bg-cream px-4 text-sm font-semibold"
          >
            Already ordered? Track my order →
          </Link>
        </header>

        <Suspense fallback={<p className="mt-6 text-center">Brewing the menu…</p>}>
          <Menu />
        </Suspense>

        <p className="mt-5 flex justify-between border-t-[1.5px] border-brown pt-2.5 text-[11px] font-semibold tracking-widest">
          <span>PICKUP ONLY · DAILY 8–3 &amp; 7–10</span>
          <span>EGP</span>
        </p>
      </div>
    </main>
  );
}

async function Menu() {
  const supabase = await createClient();
  const [itemsRes, addonsRes] = await Promise.all([
    supabase
      .from("menu_items")
      .select("id, category, name, description, price, is_signature, status, paused_display")
      .in("status", ["active", "paused"])
      .order("sort_order"),
    supabase.from("addons").select("id, name, price").eq("status", "active").order("sort_order"),
  ]);

  if (itemsRes.error || addonsRes.error) {
    return <p role="alert" className="mt-6 text-center">The menu is unavailable right now. Please try again in a minute.</p>;
  }

  const items: MenuItem[] = itemsRes.data
    .filter((i) => i.status === "active" || i.paused_display === "greyed")
    .map((i) => ({
      id: i.id,
      category: i.category,
      name: i.name,
      description: i.description,
      price: Number(i.price),
      is_signature: i.is_signature,
      available: i.status === "active",
    }));
  const addons = addonsRes.data.map((a) => ({ id: a.id, name: a.name, price: Number(a.price) }));

  return <MenuClient items={items} addons={addons} />;
}

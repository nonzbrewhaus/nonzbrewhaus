import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";

// Phase 1 placeholder: proves the Supabase connection by listing the live menu. Replaced in Phase 3.
export default function Home() {
  return (
    <main className="mx-auto w-full max-w-md p-4 py-10">
      <div className="card p-6">
        <p className="text-center text-xs tracking-[0.3em]">BREW HAUS</p>
        <h1 className="mt-2 text-center font-serif text-5xl font-bold italic">Menu</h1>
        <p className="text-center font-script text-2xl">Pick up, sip, repeat.</p>

        <Suspense fallback={<p className="mt-6 text-center">Loading menu…</p>}>
          <MenuList />
        </Suspense>

        <p className="mt-8 border-t border-brown pt-3 text-xs tracking-widest">PICKUP ONLY · PRICES IN EGP · ORDERING SOON</p>
      </div>
    </main>
  );
}

async function MenuList() {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("menu_items")
    .select("id, name, price, is_signature")
    .eq("status", "active")
    .order("sort_order");

  if (error) return <p role="alert" className="mt-6 text-center">Menu unavailable right now.</p>;

  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => (
        <li key={item.id} className="flex items-baseline gap-2">
          <span className={item.is_signature ? "font-semibold" : ""}>
            {item.is_signature && <span className="text-gold" aria-hidden>✦ </span>}
            {item.name}
          </span>
          <span className="flex-1 border-b border-dotted border-brown/40" aria-hidden />
          <span className="font-semibold">{Number(item.price)}</span>
        </li>
      ))}
    </ul>
  );
}

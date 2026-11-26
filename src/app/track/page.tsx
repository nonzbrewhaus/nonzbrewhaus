import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { RecentOrders } from "./recent-orders";

export default function TrackPage({ searchParams }: PageProps<"/track">) {
  return (
    <main className="mx-auto w-full max-w-md px-3.5 pb-10 pt-4">
      <div className="card px-5 py-6">
        <Link href="/" className="inline-flex min-h-11 items-center text-[15px] font-bold">← Back to menu</Link>
        <h1 className="font-serif text-[34px] font-bold italic">Track my order</h1>
        <p className="mt-1 text-sm">Enter the order number from your order page, like <strong>K7Q2M8XP</strong>.</p>

        <form action="/track" className="mt-4 flex gap-2">
          <label htmlFor="code" className="sr-only">Order number</label>
          <input
            id="code"
            name="code"
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={12}
            placeholder="Order number"
            className="field flex-1 text-base uppercase tracking-widest"
          />
          <button className="btn btn-primary">Find</button>
        </form>

        <Suspense>
          <Lookup searchParams={searchParams} />
        </Suspense>

        <RecentOrders />
      </div>
    </main>
  );
}

async function Lookup({ searchParams }: { searchParams: PageProps<"/track">["searchParams"] }) {
  const { code: raw } = await searchParams;
  if (typeof raw !== "string" || !raw.trim()) return null;

  // Forgive "#", spaces, dashes and lowercase.
  const code = raw.toUpperCase().replace(/[#\s-]/g, "");
  if (/^[A-HJ-NP-Z2-9]{8}$/.test(code)) {
    const supabase = await createClient();
    const { data } = await supabase.rpc("get_order", { p_code: code });
    if (data) redirect(`/o/${code}`);
  }
  return (
    <p role="alert" className="mt-3 rounded-xl border-[1.5px] border-brown bg-cream p-3 text-sm font-semibold">
      We couldn&apos;t find order “{raw.slice(0, 20)}”. Check the 8 letters and numbers, or message us on Instagram (@nonzbrewhaus).
    </p>
  );
}

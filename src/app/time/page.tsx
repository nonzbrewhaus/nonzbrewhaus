import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { TimeClient, type Slot } from "./time-client";

export default function TimePage() {
  return (
    <main className="mx-auto w-full max-w-md px-3.5 pb-32 pt-4">
      <Suspense fallback={<p className="card p-6 text-center">Checking open slots…</p>}>
        <Slots />
      </Suspense>
    </main>
  );
}

async function Slots() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("slot_availability");
  if (error) return <p role="alert" className="card p-6 text-center">Pickup times are unavailable right now. Please try again in a minute.</p>;

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
  return <TimeClient slots={data as Slot[]} today={today} />;
}

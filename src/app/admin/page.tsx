import { Suspense } from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="card p-6">Loading…</p>}>
      <Welcome />
    </Suspense>
  );
}

async function Welcome() {
  const { email } = await requireAdmin();
  return (
    <section className="card p-6">
      <h1 className="font-serif text-3xl font-bold italic">Today</h1>
      <p className="mt-1 text-sm">Signed in as {email}</p>
      <p className="mt-4">The orders board arrives with online ordering (Phase 5). For now you can manage:</p>
      <ul className="mt-3 list-inside list-disc space-y-1">
        <li><Link className="underline" href="/admin/menu">Menu</Link>: drinks, add-ons, prices, pause or archive items</li>
        <li><Link className="underline" href="/admin/schedule">Schedule</Link>: hours, slot limits, days off</li>
        <li><Link className="underline" href="/admin/settings">Settings</Link>: InstaPay, WhatsApp, hold time, margins</li>
      </ul>
    </section>
  );
}

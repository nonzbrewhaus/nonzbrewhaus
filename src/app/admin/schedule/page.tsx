import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { addBlockedDate, removeBlockedDate, saveShift, saveShiftAllDays } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
// Show the week starting Saturday, as it's usually counted in Egypt.
const DAY_ORDER = [6, 0, 1, 2, 3, 4, 5];

type Rule = {
  id: string;
  weekday: number;
  shift: "morning" | "evening";
  is_open: boolean;
  open_time: string;
  close_time: string;
  slot_minutes: number;
  max_orders_per_slot: number;
  max_drinks_per_slot: number;
};

export default function SchedulePage() {
  return (
    <Suspense fallback={<p className="card p-6">Loading schedule…</p>}>
      <Schedule />
    </Suspense>
  );
}

async function Schedule() {
  const { supabase } = await requireAdmin();
  const [rulesRes, blockedRes] = await Promise.all([
    supabase.from("schedule_rules").select("*"),
    supabase.from("blocked_dates").select("*").gte("date", new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" })).order("date"),
  ]);
  if (rulesRes.error || blockedRes.error) throw rulesRes.error ?? blockedRes.error;
  const rules = rulesRes.data as Rule[];
  const firstOf = (shift: Rule["shift"]) => rules.find((r) => r.shift === shift);

  return (
    <div className="space-y-4">
      <section className="card p-4 sm:p-6">
        <h1 className="font-serif text-3xl font-bold italic">Schedule</h1>
        <p className="mt-1 text-sm">
          Each shift is split into pickup slots. A slot is full when it reaches either its order limit or its drink limit.
        </p>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="font-serif text-2xl font-bold italic">Same for every day</h2>
        <p className="text-sm">Quickest way to change your hours: this overwrites the shift on all 7 days.</p>
        <div className="mt-4 grid gap-6 sm:grid-cols-2">
          {(["morning", "evening"] as const).map((shift) => (
            <div key={shift}>
              <h3 className="font-semibold capitalize">{shift}</h3>
              <ActionForm
                action={saveShiftAllDays.bind(null, shift)}
                submitLabel={`Apply to all ${shift}s`}
                confirm={`Overwrite the ${shift} shift on all 7 days?`}
                className="mt-2 space-y-3"
              >
                <ShiftFields rule={firstOf(shift)} />
              </ActionForm>
            </div>
          ))}
        </div>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="font-serif text-2xl font-bold italic">Day by day</h2>
        <ul className="mt-2 divide-y divide-brown/20">
          {DAY_ORDER.map((d) => (
            <li key={d} className="py-3">
              <details>
                <summary className="cursor-pointer py-1 font-semibold">
                  {DAYS[d]}{" "}
                  <span className="font-normal">
                    ·{" "}
                    {rules
                      .filter((r) => r.weekday === d)
                      .sort((a, b) => a.open_time.localeCompare(b.open_time))
                      .map((r) => (r.is_open ? `${r.open_time.slice(0, 5)}–${r.close_time.slice(0, 5)}` : `${r.shift} closed`))
                      .join(" & ")}
                  </span>
                </summary>
                <div className="mt-3 grid gap-6 sm:grid-cols-2">
                  {rules
                    .filter((r) => r.weekday === d)
                    .sort((a, b) => a.open_time.localeCompare(b.open_time))
                    .map((r) => (
                      <div key={r.id}>
                        <h3 className="font-semibold capitalize">{r.shift}</h3>
                        <ActionForm action={saveShift.bind(null, r.id)} submitLabel="Save" className="mt-2 space-y-3">
                          <ShiftFields rule={r} />
                        </ActionForm>
                      </div>
                    ))}
                </div>
              </details>
            </li>
          ))}
        </ul>
      </section>

      <section className="card p-4 sm:p-6">
        <h2 className="font-serif text-2xl font-bold italic">Days off</h2>
        <p className="text-sm">No pickups can be booked on these dates.</p>
        <ul className="mt-3 space-y-2">
          {blockedRes.data.length === 0 && <li className="text-sm">No upcoming days off.</li>}
          {blockedRes.data.map((b: { date: string; reason: string }) => (
            <li key={b.date} className="flex flex-wrap items-center gap-3">
              <span className="font-semibold">{b.date}</span>
              <span className="text-sm">{b.reason}</span>
              <ActionForm action={removeBlockedDate.bind(null, b.date)} submitLabel="Remove" variant="secondary" />
            </li>
          ))}
        </ul>
        <ActionForm action={addBlockedDate} submitLabel="Add day off" className="mt-4 grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-end">
          <label className="block">
            <span className="text-sm font-semibold">Date</span>
            <input type="date" name="date" required className="field mt-1" />
          </label>
          <label className="block">
            <span className="text-sm font-semibold">Reason (optional)</span>
            <input name="reason" maxLength={120} className="field mt-1" />
          </label>
        </ActionForm>
      </section>
    </div>
  );
}

function ShiftFields({ rule }: { rule?: Rule }) {
  return (
    <>
      <label className="flex min-h-11 items-center gap-2">
        <input type="checkbox" name="is_open" defaultChecked={rule?.is_open ?? true} className="size-5 accent-[var(--brown)]" />
        <span className="text-sm font-semibold">Open</span>
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Opens</span>
          <input type="time" name="open_time" required defaultValue={rule?.open_time.slice(0, 5)} className="field mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Closes</span>
          <input type="time" name="close_time" required defaultValue={rule?.close_time.slice(0, 5)} className="field mt-1" />
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="text-sm font-semibold">Slot (min)</span>
          <input type="number" name="slot_minutes" min={10} max={240} step={5} required defaultValue={rule?.slot_minutes ?? 60} className="field mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Max orders</span>
          <input type="number" name="max_orders_per_slot" min={1} max={100} required defaultValue={rule?.max_orders_per_slot ?? 5} className="field mt-1" />
        </label>
        <label className="block">
          <span className="text-sm font-semibold">Max drinks</span>
          <input type="number" name="max_drinks_per_slot" min={1} max={500} required defaultValue={rule?.max_drinks_per_slot ?? 10} className="field mt-1" />
        </label>
      </div>
    </>
  );
}

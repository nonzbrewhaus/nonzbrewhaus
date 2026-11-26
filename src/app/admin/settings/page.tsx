import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { saveSettings, sendTestEmail } from "./actions";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  return (
    <Suspense fallback={<p className="card p-6">Loading settings…</p>}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  const { supabase } = await requireAdmin();
  const { data: s, error } = await supabase.from("settings").select("*").eq("id", 1).single();
  if (error) throw error;

  return (
    <section className="card p-4 sm:p-6">
      <h1 className="font-serif text-3xl font-bold italic">Settings</h1>
      <ActionForm action={saveSettings} submitLabel="Save settings" className="mt-4 space-y-6">
        <fieldset className="space-y-3">
          <legend className="font-serif text-xl font-bold italic">Payments & contact</legend>
          <Field label="InstaPay handle or number (shown to customers)" name="instapay_handle" defaultValue={s.instapay_handle} placeholder="nonzz@instapay" />
          <Field
            label="InstaPay payment link (customers tap it to open InstaPay)"
            name="instapay_link"
            type="url"
            defaultValue={s.instapay_link}
            placeholder="https://ipn.eg/S/yourname/instapay/…"
          />
          <p className="text-sm">
            Get it in the InstaPay app: open your profile, tap <strong>Share</strong> (or <strong>Payment link</strong>) and copy the
            ipn.eg link. Customers who tap it go straight to paying you.
          </p>
          <Field label="WhatsApp number" name="whatsapp_number" defaultValue={s.whatsapp_number} placeholder="+201xxxxxxxxx" type="tel" />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-serif text-xl font-bold italic">Orders</legend>
          <Field label="Hold unpaid orders for (minutes)" name="hold_minutes" type="number" min={5} max={240} defaultValue={s.hold_minutes} />
          <Field label="Book how many days ahead (0 = today only)" name="booking_days_ahead" type="number" min={0} max={14} defaultValue={s.booking_days_ahead} />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="font-serif text-xl font-bold italic">Costs & reports</legend>
          <Field label="Overhead added to drink cost (%)" name="overhead_pct" type="number" min={0} max={100} step="0.5" defaultValue={Number(s.overhead_pct)} />
          <Field label="Target margin (%)" name="margin_target_pct" type="number" min={0} max={100} step="0.5" defaultValue={Number(s.margin_target_pct)} />
          <Field label="Daily low-stock email at" name="low_stock_email_time" type="time" defaultValue={String(s.low_stock_email_time).slice(0, 5)} />
          <label className="block">
            <span className="text-sm font-semibold">Week starts on</span>
            <select name="week_starts_on" defaultValue={s.week_starts_on} className="field mt-1">
              {DAYS.map((d, i) => (
                <option key={d} value={i}>{d}</option>
              ))}
            </select>
          </label>
        </fieldset>
      </ActionForm>

      <div className="mt-8 border-t-[1.5px] border-brown pt-4">
        <h2 className="font-serif text-xl font-bold italic">Low-stock email</h2>
        <p className="mt-1 text-sm">
          Every day at the time above (Cairo), if anything is Low or Out, you get one email listing it. Nothing low means no email.
          {s.low_stock_last_sent && <> Last daily check: {s.low_stock_last_sent}.</>}
        </p>
        <ActionForm action={sendTestEmail} submitLabel="Send test email now" variant="secondary" className="mt-3" />
      </div>
    </section>
  );
}

function Field({ label, ...input }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-semibold">{label}</span>
      <input {...input} className="field mt-1" />
    </label>
  );
}

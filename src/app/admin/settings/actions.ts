"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { InputError, num, text, time, type ActionResult } from "@/lib/form";

/** Asks the low-stock-email Edge Function to send a test email now (it re-checks that the caller is the owner). */
export async function sendTestEmail(_prev: ActionResult | null, _fd: FormData): Promise<ActionResult> {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, message: "Please sign in again." };
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/low-stock-email`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ mode: "test" }),
      cache: "no-store",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      const hint = String(body?.error ?? "").includes("RESEND_API_KEY") ? " Add your Resend API key in Supabase first." : "";
      return { ok: false, message: `${body?.error ?? `Failed (${res.status}).`}${hint}` };
    }
    return { ok: true, message: `Sent! Check your inbox (and spam) for "[Test] Nonzz's stock".` };
  } catch (e) {
    console.error(e);
    return { ok: false, message: "Couldn't reach the email service. Please try again." };
  }
}

export async function saveSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();

    const whatsapp = text(fd, "whatsapp_number", { max: 20 }).replace(/[\s-]/g, "");
    if (whatsapp && !/^\+20\d{10}$/.test(whatsapp)) throw new InputError("WhatsApp number must look like +201xxxxxxxxx.");

    // Customers tap this link to pay, so only accept a real https URL.
    const instapayLink = text(fd, "instapay_link", { max: 300 });
    if (instapayLink) {
      let u: URL;
      try {
        u = new URL(instapayLink);
      } catch {
        throw new InputError("InstaPay link must be a full link starting with https://");
      }
      if (u.protocol !== "https:") throw new InputError("InstaPay link must start with https://");
    }

    const { error } = await supabase
      .from("settings")
      .update({
        instapay_handle: text(fd, "instapay_handle", { max: 80 }),
        instapay_link: instapayLink,
        whatsapp_number: whatsapp,
        hold_minutes: num(fd, "hold_minutes", { min: 5, max: 240, int: true }),
        booking_days_ahead: num(fd, "booking_days_ahead", { min: 0, max: 14, int: true }),
        overhead_pct: num(fd, "overhead_pct", { min: 0, max: 100 }),
        margin_target_pct: num(fd, "margin_target_pct", { min: 0, max: 100 }),
        low_stock_email_time: time(fd, "low_stock_email_time"),
        week_starts_on: num(fd, "week_starts_on", { min: 0, max: 6, int: true }),
      })
      .eq("id", 1);
    if (error) throw error;

    revalidatePath("/admin/settings");
    return { ok: true, message: "Settings saved." };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

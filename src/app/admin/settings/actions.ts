"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { InputError, num, text, time, type ActionResult } from "@/lib/form";

export async function saveSettings(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();

    const whatsapp = text(fd, "whatsapp_number", { max: 20 }).replace(/[\s-]/g, "");
    if (whatsapp && !/^\+20\d{10}$/.test(whatsapp)) throw new InputError("WhatsApp number must look like +201xxxxxxxxx.");

    const { error } = await supabase
      .from("settings")
      .update({
        instapay_handle: text(fd, "instapay_handle", { max: 80 }),
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

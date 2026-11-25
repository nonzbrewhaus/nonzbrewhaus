"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { InputError, bool, num, optionalDate, text, time, uuid, type ActionResult } from "@/lib/form";

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/admin/schedule");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

function shiftFields(fd: FormData) {
  const open_time = time(fd, "open_time");
  const close_time = time(fd, "close_time");
  if (close_time <= open_time) throw new InputError("Close time must be after open time.");
  return {
    is_open: bool(fd, "is_open"),
    open_time,
    close_time,
    slot_minutes: num(fd, "slot_minutes", { min: 10, max: 240, int: true }),
    max_orders_per_slot: num(fd, "max_orders_per_slot", { min: 1, max: 100, int: true }),
    max_drinks_per_slot: num(fd, "max_drinks_per_slot", { min: 1, max: 500, int: true }),
  };
}

export async function saveShift(id: string, _prev: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from("schedule_rules").update(shiftFields(fd)).eq("id", uuid(id));
    if (error) throw error;
    return "Saved.";
  });
}

export async function saveShiftAllDays(shift: "morning" | "evening", _prev: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    if (shift !== "morning" && shift !== "evening") throw new InputError("Invalid shift.");
    const { error } = await supabase.from("schedule_rules").update(shiftFields(fd)).eq("shift", shift);
    if (error) throw error;
    return `Applied to every day's ${shift}.`;
  });
}

export async function addBlockedDate(_prev: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    const date = optionalDate(fd, "date");
    if (!date) throw new InputError("Pick a date.");
    const { error } = await supabase.from("blocked_dates").upsert({ date, reason: text(fd, "reason", { max: 120 }) });
    if (error) throw error;
    return "Day off added.";
  });
}

export async function removeBlockedDate(date: string, _prev: ActionResult | null, _fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    const fd = new FormData();
    fd.set("date", date);
    const { error } = await supabase.from("blocked_dates").delete().eq("date", optionalDate(fd, "date"));
    if (error) throw error;
    return "Removed.";
  });
}

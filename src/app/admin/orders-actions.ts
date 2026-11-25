"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { InputError, uuid, type ActionResult } from "@/lib/form";

type Status = "pending_payment" | "payment_submitted" | "confirmed" | "ready" | "picked_up" | "expired" | "cancelled";

/**
 * Moves an order to `to` only if it is still in one of `from` (guards against double taps and
 * stale screens). The customer's page updates by itself via the status broadcast trigger.
 */
async function transition(id: string, from: Status[], to: Status, extra: Record<string, unknown>, done: string): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const { data, error } = await supabase
      .from("orders")
      .update({ status: to, ...extra })
      .eq("id", uuid(id))
      .in("status", from)
      .select("id");
    if (error) throw error;
    revalidatePath("/admin");
    revalidatePath("/admin/payments");
    if (!data?.length) return { ok: false, message: "This order changed in the meantime. The board has been refreshed." };
    return { ok: true, message: done };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

// shortcut: Phase 6 deducts recipe stock inside confirm (and returns it on cancel); until recipes exist nothing is deducted.
export async function confirmPayment(id: string, _prev: ActionResult | null, _fd: FormData) {
  return transition(id, ["payment_submitted"], "confirmed", { confirmed_at: new Date().toISOString() }, "Payment confirmed ✓");
}

export async function rejectPayment(id: string, _prev: ActionResult | null, _fd: FormData) {
  return transition(id, ["payment_submitted"], "cancelled", { cancelled_at: new Date().toISOString() }, "Payment rejected, order cancelled.");
}

export async function markReady(id: string, _prev: ActionResult | null, _fd: FormData) {
  return transition(id, ["confirmed"], "ready", {}, "Marked ready.");
}

export async function markPickedUp(id: string, _prev: ActionResult | null, _fd: FormData) {
  return transition(id, ["confirmed", "ready"], "picked_up", {}, "Picked up ✓");
}

export async function cancelOrder(id: string, _prev: ActionResult | null, _fd: FormData) {
  return transition(
    id,
    ["pending_payment", "payment_submitted", "confirmed", "ready"],
    "cancelled",
    { cancelled_at: new Date().toISOString() },
    "Order cancelled.",
  );
}

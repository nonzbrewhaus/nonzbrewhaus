"use server";

import { createClient } from "@/lib/supabase/server";
import { ORDER_ERRORS } from "@/lib/booking";

export type PlaceOrderInput = {
  name: string;
  phone: string;
  notes: string;
  pickupAt: string;
  items: { itemId: string; qty: number; addonIds: string[]; note?: string }[];
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Public endpoint: shape-checks input, then create_order (which re-validates and prices everything). */
export async function placeOrder(input: PlaceOrderInput): Promise<{ ok: true; code: string } | { ok: false; error: string; slotProblem?: boolean }> {
  const items = Array.isArray(input?.items) ? input.items : [];
  const shapeOk =
    typeof input?.name === "string" &&
    typeof input?.phone === "string" &&
    typeof input?.notes === "string" &&
    typeof input?.pickupAt === "string" &&
    !Number.isNaN(Date.parse(input.pickupAt)) &&
    items.length > 0 &&
    items.length <= 20 &&
    items.every(
      (i) =>
        typeof i?.itemId === "string" && UUID.test(i.itemId) &&
        Number.isInteger(i.qty) && i.qty >= 1 && i.qty <= 10 &&
        Array.isArray(i.addonIds) && i.addonIds.length <= 5 && i.addonIds.every((a) => typeof a === "string" && UUID.test(a)) &&
        (i.note === undefined || (typeof i.note === "string" && i.note.length <= 120)),
    );
  if (!shapeOk) return { ok: false, error: ORDER_ERRORS.INVALID_ITEMS };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_order", {
    p_name: input.name.slice(0, 200),
    p_phone: input.phone.slice(0, 40),
    p_notes: input.notes.slice(0, 1000),
    p_pickup_at: input.pickupAt,
    p_items: items.map((i) => ({ item_id: i.itemId, qty: i.qty, addon_ids: i.addonIds, note: (i.note ?? "").trim() })),
  });

  if (error) {
    const known = ORDER_ERRORS[error.message];
    if (!known) console.error("create_order failed", error);
    return {
      ok: false,
      error: known ?? "We couldn't place your order. Please try again.",
      slotProblem: error.message === "SLOT_FULL" || error.message === "SLOT_UNAVAILABLE",
    };
  }
  return { ok: true, code: String(data) };
}

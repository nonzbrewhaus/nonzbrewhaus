"use server";

import { runAdmin } from "@/lib/admin-action";
import { InputError, bool, num, oneOf, text, uuid, type ActionResult } from "@/lib/form";

const PATHS = ["/admin/inventory", "/admin/recipes", "/admin/margins", "/admin", "/"];

function ingredientFields(fd: FormData) {
  return {
    name: text(fd, "name", { min: 1, max: 60 }),
    kind: oneOf(fd, "kind", ["ingredient", "packaging"] as const),
    unit: oneOf(fd, "unit", ["g", "ml", "pcs"] as const),
    low_threshold: num(fd, "low_threshold", { min: 0, max: 1_000_000 }),
  };
}

export async function addIngredient(_prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase.from("ingredients").insert(ingredientFields(fd));
    if (error) throw error;
    return "Added. Enter a restock or a count to start tracking its stock.";
  });
}

export async function updateIngredient(id: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase
      .from("ingredients")
      .update({ ...ingredientFields(fd), is_active: bool(fd, "is_active") })
      .eq("id", uuid(id));
    if (error) throw error;
    return "Saved.";
  });
}

export async function restockIngredient(id: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const qty = num(fd, "qty", { min: 0.001, max: 1_000_000 });
    const total = num(fd, "total_price", { min: 0, max: 10_000_000 });
    const { error } = await supabase.rpc("restock", {
      p_ingredient: uuid(id),
      p_qty: qty,
      p_total_price: total,
      p_note: text(fd, "note", { max: 120 }),
    });
    if (error) throw error;
    return `Restocked ${qty}. New average cost saved.`;
  });
}

export async function adjustIngredient(id: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const mode = oneOf(fd, "mode", ["waste", "recount"] as const);
    const amount = num(fd, "amount", { min: 0, max: 1_000_000 });
    const note = text(fd, "note", { min: 1, max: 120 });
    if (mode === "waste" && amount === 0) throw new InputError("Enter how much was wasted.");
    const { error } = await supabase.rpc("adjust_stock", { p_ingredient: uuid(id), p_mode: mode, p_amount: amount, p_note: note });
    if (error) throw error;
    return mode === "waste" ? "Waste recorded." : "Count saved. Stock now matches your shelf.";
  });
}

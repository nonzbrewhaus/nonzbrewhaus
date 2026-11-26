"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { InputError, bool, num, oneOf, optionalDate, text, uuid, type ActionResult } from "@/lib/form";

export type Kind = "item" | "addon";
const TABLE = { item: "menu_items", addon: "addons" } as const;

function table(kind: Kind) {
  if (kind !== "item" && kind !== "addon") throw new InputError("Invalid kind.");
  return TABLE[kind];
}

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    const message = await fn();
    revalidatePath("/admin/menu");
    revalidatePath("/admin/recipes");
    revalidatePath("/admin/margins");
    revalidatePath("/");
    return { ok: true, message };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, message: e.message };
    // redirect() from requireAdmin must propagate.
    if (e && typeof e === "object" && "digest" in e) throw e;
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

/** Create (id = null) or update a drink / add-on's details. New products start Paused so they stay hidden until ready. */
export async function saveProduct(kind: Kind, id: string | null, _prev: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    const t = table(kind);
    const row: Record<string, unknown> = {
      name: text(fd, "name", { min: 1, max: 80 }),
      price: num(fd, "price", { min: 0, max: 10_000 }),
      sort_order: num(fd, "sort_order", { min: 0, max: 999, int: true }),
    };
    if (kind === "item") {
      row.category = oneOf(fd, "category", ["coffee", "matcha"] as const);
      row.description = text(fd, "description", { max: 200 });
      row.is_signature = bool(fd, "is_signature");
    }

    if (id) {
      const { error } = await supabase.from(t).update(row).eq("id", uuid(id));
      if (error) throw error;
      return "Saved. Price changes apply to new orders only.";
    }
    const { error } = await supabase.from(t).insert({ ...row, status: "paused" });
    if (error) throw error;
    return "Added as Paused. Give it a recipe (Recipes page), then set it Active.";
  });
}

export async function setStatus(kind: Kind, id: string, _prev: ActionResult | null, fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    const status = oneOf(fd, "status", ["active", "paused", "archived"] as const);
    const paused_display = oneOf(fd, "paused_display", ["greyed", "hidden"] as const);
    const resume_on = status === "paused" ? optionalDate(fd, "resume_on") : null;
    if (status === "active") {
      // Selling something without a recipe would never take stock or show a cost.
      const { data: r, error: rErr } = await supabase
        .from("recipes")
        .select("id")
        .eq(kind === "item" ? "menu_item_id" : "addon_id", uuid(id))
        .eq("is_active", true)
        .maybeSingle();
      if (rErr) throw rErr;
      if (!r) throw new InputError("Add a recipe and set it active (Recipes page) before making this Active.");
    }
    const { error } = await supabase.from(table(kind)).update({ status, paused_display, resume_on }).eq("id", uuid(id));
    if (error) throw error;
    return status === "archived" ? "Archived. Restore it any time from the Archived tab." : "Status updated.";
  });
}

export async function deleteProduct(kind: Kind, id: string, _prev: ActionResult | null, _fd: FormData) {
  return run(async () => {
    const { supabase } = await requireAdmin();
    const { error } = await supabase.from(table(kind)).delete().eq("id", uuid(id));
    // 23503 = still referenced by orders/recipes: history must be kept.
    if (error?.code === "23503") throw new InputError("This item has orders or recipes, so it can only be archived.");
    if (error) throw error;
    return "Deleted.";
  });
}

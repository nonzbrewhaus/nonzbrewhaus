"use server";

import { runAdmin } from "@/lib/admin-action";
import { InputError, num, text, uuid, type ActionResult } from "@/lib/form";

const PATHS = ["/admin/recipes", "/admin/margins", "/admin/inventory", "/admin/menu", "/"];

export async function createRecipe(kind: "item" | "addon", productId: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    if (kind !== "item" && kind !== "addon") throw new InputError("Invalid product.");
    const { error } = await supabase.from("recipes").insert({
      [kind === "item" ? "menu_item_id" : "addon_id"]: uuid(productId),
      name: text(fd, "name", { min: 1, max: 80 }),
    });
    if (error) throw error;
    return "Recipe created. Add its ingredients, then set it active.";
  });
}

export async function renameRecipe(id: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase.from("recipes").update({ name: text(fd, "name", { min: 1, max: 80 }) }).eq("id", uuid(id));
    if (error) throw error;
    return "Renamed.";
  });
}

export async function setActiveRecipe(id: string, _prev: ActionResult | null, _fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase.rpc("set_active_recipe", { p_recipe: uuid(id) });
    if (error) throw error;
    return "Now active. New confirmed orders use this recipe.";
  });
}

export async function duplicateRecipe(id: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase.rpc("duplicate_recipe", { p_recipe: uuid(id), p_name: text(fd, "name", { min: 1, max: 80 }) });
    if (error) throw error;
    return "Copied. Edit the copy, then set it active when you're happy.";
  });
}

export async function archiveRecipe(id: string, _prev: ActionResult | null, _fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { data, error } = await supabase
      .from("recipes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", uuid(id))
      .eq("is_active", false)
      .select("id");
    if (error) throw error;
    if (!data?.length) throw new InputError("Set another recipe active before archiving this one.");
    return "Archived.";
  });
}

export async function addLine(recipeId: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const replaces = String(fd.get("replaces") ?? "");
    const { error } = await supabase.from("recipe_lines").insert({
      recipe_id: uuid(recipeId),
      ingredient_id: uuid(fd.get("ingredient_id")),
      qty: num(fd, "qty", { min: 0.001, max: 100_000 }),
      replaces_ingredient_id: replaces ? uuid(replaces) : null,
    });
    if (error) throw error;
    return "Ingredient added.";
  });
}

export async function updateLine(lineId: string, _prev: ActionResult | null, fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase.from("recipe_lines").update({ qty: num(fd, "qty", { min: 0.001, max: 100_000 }) }).eq("id", uuid(lineId));
    if (error) throw error;
    return "Saved.";
  });
}

export async function removeLine(lineId: string, _prev: ActionResult | null, _fd: FormData) {
  return runAdmin(PATHS, async (supabase) => {
    const { error } = await supabase.from("recipe_lines").delete().eq("id", uuid(lineId));
    if (error) throw error;
    return "Removed.";
  });
}

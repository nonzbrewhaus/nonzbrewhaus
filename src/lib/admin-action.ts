import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { InputError, type ActionResult } from "@/lib/form";

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

const DB_ERRORS: Record<string, string> = {
  INVALID_INPUT: "Please check the numbers and the reason.",
  NOT_FOUND: "That item no longer exists. The page has been refreshed.",
  NOT_ALLOWED: "You're not allowed to do that.",
  EMPTY_RECIPE: "Add at least one ingredient before making this recipe active.",
};

/** Shared wrapper for owner-only server actions: admin check, friendly errors, page refresh. */
export async function runAdmin(paths: string[], fn: (supabase: Supabase) => Promise<string>): Promise<ActionResult> {
  try {
    const { supabase } = await requireAdmin();
    const message = await fn(supabase);
    paths.forEach((p) => revalidatePath(p));
    return { ok: true, message };
  } catch (e) {
    if (e instanceof InputError) return { ok: false, message: e.message };
    if (e && typeof e === "object" && "digest" in e) throw e; // redirect()
    const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
    if (DB_ERRORS[msg]) return { ok: false, message: DB_ERRORS[msg] };
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "23505") {
      return { ok: false, message: "That name is already used." };
    }
    console.error(e);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

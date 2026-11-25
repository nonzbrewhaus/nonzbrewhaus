import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Data-access gate for every admin page and server action.
 * Verifies the JWT, then asks the database whether this email is in `admins`.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/login");

  const { data: isAdmin, error } = await supabase.rpc("is_admin");
  if (error || !isAdmin) {
    await supabase.auth.signOut();
    redirect("/login?error=not_allowed");
  }

  return { supabase, email: String(data.claims.email ?? "") };
}

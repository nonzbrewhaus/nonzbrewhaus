"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/form";

export async function sendMagicLink(_prev: ActionResult | null, fd: FormData): Promise<ActionResult> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return { ok: false, message: "Enter a valid email address." };
  }

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // Never create accounts from this form: only the pre-created owner account can sign in.
    options: { shouldCreateUser: false, emailRedirectTo: `${origin}/auth/callback` },
  });

  // Same reply whether or not the email exists, so the form can't be used to probe for accounts.
  if (error && error.status === 429) return { ok: false, message: "Too many attempts. Please wait a few minutes and try again." };
  return { ok: true, message: "If this email is allowed, a sign-in link is on its way. Open it in this same browser." };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

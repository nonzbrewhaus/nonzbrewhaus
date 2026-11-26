// Daily low-stock email for Nonzz's Brew Haus.
//
// Called every hour by pg_cron (body {}), and by the admin "Send test email" button (body {"mode":"test"}
// with the owner's session token). Scheduled runs send at most once per Cairo day, at or after the time
// set in Settings, and only when something is Low or Out. Test runs require a signed-in admin.
//
// Secrets: RESEND_API_KEY (required), EMAIL_FROM (optional, default Resend's onboarding sender).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.119.2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const FROM = Deno.env.get("EMAIL_FROM") ?? "Nonzz's Brew Haus <onboarding@resend.dev>";
const SITE = "https://nonzbrewhaus-6fz7.vercel.app";

type Item = { name: string; unit: "g" | "ml" | "pcs"; available: number; days_left: number | null; stock_status: "out" | "low"; low_threshold: number };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function qty(n: number, unit: Item["unit"]) {
  const v = Number(n);
  if (unit !== "pcs" && Math.abs(v) >= 1000) return `${+(v / 1000).toFixed(2)} ${unit === "g" ? "kg" : "L"}`;
  return `${+v.toFixed(2)} ${unit}`;
}

function cairoNow(tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(new Date())
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, time: `${parts.hour === "24" ? "00" : parts.hour}:${parts.minute}` };
}

async function isAdmin(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const { data } = await db.auth.getUser(token);
  const email = data?.user?.email?.toLowerCase();
  if (!email) return false;
  const { data: row } = await db.from("admins").select("email").eq("email", email).maybeSingle();
  return !!row;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  const body = await req.json().catch(() => ({}));
  const test = body?.mode === "test";
  if (test && !(await isAdmin(req))) return json({ error: "Only the owner can send a test email." }, 403);

  const apiKey = Deno.env.get("RESEND_API_KEY");
  if (!apiKey) return json({ error: "RESEND_API_KEY is not set in Edge Function secrets." }, 500);

  const { data: s, error: sErr } = await db.from("settings").select("low_stock_email_time, timezone, low_stock_last_sent").eq("id", 1).single();
  if (sErr || !s) return json({ error: "Could not read settings." }, 500);
  const now = cairoNow(s.timezone);
  const previous: string | null = s.low_stock_last_sent;

  if (!test) {
    if (now.time < String(s.low_stock_email_time).slice(0, 5)) return json({ sent: false, reason: "before send time" });
    // Claim today's run atomically so overlapping calls can't send twice.
    const { data: claimed } = await db
      .from("settings")
      .update({ low_stock_last_sent: now.day })
      .eq("id", 1)
      .or(`low_stock_last_sent.is.null,low_stock_last_sent.lt.${now.day}`)
      .select("id");
    if (!claimed?.length) return json({ sent: false, reason: "already handled today" });
  }

  const { data: items, error: iErr } = await db
    .from("inventory_status")
    .select("name, unit, available, days_left, stock_status, low_threshold")
    .eq("is_active", true)
    .in("stock_status", ["out", "low"])
    .order("stock_status", { ascending: false })
    .order("name");
  if (iErr) return json({ error: "Could not read inventory." }, 500);
  const list = (items ?? []) as Item[];
  if (!list.length && !test) return json({ sent: false, reason: "nothing low" });

  const { data: admins } = await db.from("admins").select("email");
  const to = (admins ?? []).map((a) => a.email);
  if (!to.length) return json({ error: "No admin email set." }, 500);

  const rows = list
    .map((i) => {
      const badge = i.stock_status === "out"
        ? '<span style="background:#E8A6A6;border:1px solid #3A2218;border-radius:99px;padding:1px 8px;font-weight:700">OUT</span>'
        : '<span style="background:#F6D58E;border:1px solid #3A2218;border-radius:99px;padding:1px 8px;font-weight:700">LOW</span>';
      const days = i.days_left !== null ? ` · ~${Math.max(0, Number(i.days_left))} days left` : "";
      return `<tr><td style="padding:8px 0;border-bottom:1px solid #e6cfd6">${badge}&nbsp; <strong>${esc(i.name)}</strong></td>
        <td style="padding:8px 0;border-bottom:1px solid #e6cfd6;text-align:right">${esc(qty(i.available, i.unit))} available${days}</td></tr>`;
    })
    .join("");
  const outCount = list.filter((i) => i.stock_status === "out").length;
  const subject = list.length
    ? `${test ? "[Test] " : ""}Nonzz's stock: ${outCount ? `${outCount} out, ` : ""}${list.length - outCount} low`
    : "[Test] Nonzz's stock: all good ✓";
  const html = `<div style="font-family:Arial,sans-serif;background:#F0E4DA;padding:24px;color:#3A2218">
    <div style="max-width:520px;margin:auto;background:#F2C6D3;border:1.5px solid #3A2218;border-radius:16px;padding:20px 22px">
      <p style="margin:0;font-size:22px;font-weight:700;font-style:italic">Nonzz's Brew Haus</p>
      <p style="margin:4px 0 14px">${test ? "Test email. " : ""}Stock check for ${now.day}</p>
      ${list.length
        ? `<table style="width:100%;border-collapse:collapse;font-size:14px">${rows}</table>
           <p style="font-size:13px;margin-top:14px">Drinks that need an <strong>OUT</strong> item show as "Sold out" on the menu until you restock.</p>`
        : "<p>Nothing is low or out right now. ✓</p>"}
      <p style="margin-top:18px"><a href="${SITE}/admin/inventory" style="background:#3A2218;color:#F0E4DA;padding:10px 18px;border-radius:99px;text-decoration:none;font-weight:700">Open inventory</a></p>
    </div></div>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });
  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend failed", res.status, detail);
    // Let the next hourly run try again.
    if (!test) await db.from("settings").update({ low_stock_last_sent: previous }).eq("id", 1);
    return json({ error: `Email service error (${res.status}). ${res.status === 403 ? "With Resend's test sender you can only email the address you signed up to Resend with." : ""}` }, 502);
  }
  return json({ sent: true, items: list.length, to: to.length });
});

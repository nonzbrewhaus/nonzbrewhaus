import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Sends the customer straight into a WhatsApp chat with the shop, so the shop's number never
// appears in the order page itself (only WhatsApp shows it, once the chat opens).
export async function GET(request: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const back = new URL(`/o/${encodeURIComponent(code)}`, request.nextUrl.origin);
  if (!/^[A-HJ-NP-Z2-9]{8}$/.test(code)) return NextResponse.redirect(new URL("/", request.nextUrl.origin));

  const supabase = await createClient();
  const [{ data: order }, { data: s }] = await Promise.all([
    supabase.rpc("get_order", { p_code: code }),
    supabase.rpc("customer_settings").single(),
  ]);
  const digits = String((s as { whatsapp_number?: string } | null)?.whatsapp_number ?? "").replace(/\D/g, "");
  if (!order || !digits) return NextResponse.redirect(back);

  const text = encodeURIComponent(`Hi Nonzz's! About my order ${code}`);
  return NextResponse.redirect(`https://wa.me/${digits}?text=${text}`, 302);
}

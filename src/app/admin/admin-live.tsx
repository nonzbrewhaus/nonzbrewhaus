"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/** Refreshes the board whenever any order changes (Realtime, owner-only via RLS); shows a small live dot. */
export function AdminLive() {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => {
      // Several changes can arrive together (e.g. the expiry job): refresh once.
      clearTimeout(timer);
      timer = setTimeout(() => router.refresh(), 400);
    };
    const channel = supabase
      .channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, refresh)
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold" role="status">
      <span className={`size-2.5 rounded-full ${live ? "bg-green-700" : "bg-brown/40"}`} aria-hidden />
      {live ? "Live" : "Connecting…"}
    </span>
  );
}

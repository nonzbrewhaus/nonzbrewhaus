"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** mm:ss until the hold expires; refreshes the page at zero so it shows "Expired". */
export function Countdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const end = new Date(expiresAt).getTime();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (n >= end) {
        clearInterval(t);
        router.refresh();
      }
    }, 1000);
    return () => clearInterval(t);
  }, [end, router]);

  const left = Math.max(0, Math.floor((end - now) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    // Server and browser clocks differ by a second or two: the browser's value wins.
    <strong className="text-xl" aria-label={`${mm} minutes ${ss} seconds`} suppressHydrationWarning>
      {mm}:{ss}
    </strong>
  );
}

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {}
      }}
      className="min-h-11 rounded-full border-[1.5px] border-brown bg-pink px-3.5 font-bold"
    >
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

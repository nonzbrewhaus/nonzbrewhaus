"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heic",
};
const MAX_BYTES = 5 * 1024 * 1024; // matches the bucket limit

/** Shrinks big photos to a JPEG ≤ 2000px so they fit the 5 MB limit. */
async function shrink(file: File): Promise<Blob | null> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.85));
  } catch {
    return null;
  }
}

export function ProofUpload({ code, again = false }: { code: string; again?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    setError(null);

    if (!picked.type.startsWith("image/")) {
      setError("Please choose a screenshot or photo of your InstaPay receipt.");
      return;
    }
    let body: Blob = picked;
    let type = picked.type;
    if (!EXT[type] || picked.size > MAX_BYTES) {
      const smaller = await shrink(picked);
      if (!smaller || smaller.size > MAX_BYTES) {
        setError("That image is too large or not supported. Please send a regular screenshot (PNG or JPG).");
        return;
      }
      body = smaller;
      type = "image/jpeg";
    }

    setPreview(URL.createObjectURL(body));
    setBusy(true);
    const supabase = createClient();
    const path = `${code}/${crypto.randomUUID()}.${EXT[type]}`;
    const up = await supabase.storage.from("payment-proofs").upload(path, body, { contentType: type, upsert: false });
    if (up.error) {
      setBusy(false);
      setError("We couldn't upload that. Your order may have expired, or it already has 5 uploads. Message us on Instagram (@nonzbrewhaus) if you need help.");
      return;
    }
    const { error: rpcError } = await supabase.rpc("submit_payment_proof", { p_code: code, p_path: path });
    setBusy(false);
    if (rpcError) {
      setError(
        rpcError.message === "ORDER_NOT_PAYABLE"
          ? "This order can't take a payment anymore (it may have expired)."
          : "We couldn't attach the screenshot. Please try again.",
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3.5">
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="sr-only" id={`proof-${code}`} disabled={busy} />
      <label
        htmlFor={`proof-${code}`}
        className={`flex min-h-[54px] w-full cursor-pointer items-center justify-center gap-3 rounded-2xl border-[1.5px] border-dashed border-brown bg-[#FFF8F4] px-4 text-center text-base font-bold ${busy ? "opacity-70" : ""}`}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local blob: preview, nothing to optimise */}
        {preview && <img src={preview} alt="" className="h-10 w-8 rounded object-cover" />}
        {busy ? "Uploading…" : again ? "Upload a different screenshot" : "Upload payment screenshot"}
      </label>
      {error && (
        <p role="alert" className="mt-2 text-sm font-semibold text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}

/** Refreshes the page the moment the owner changes this order (Realtime broadcast), with a slow poll as backup. */
export function LiveOrder({ code }: { code: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order:${code}`)
      .on("broadcast", { event: "status" }, () => router.refresh())
      .subscribe();
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 60_000);
    const onVisible = () => document.visibilityState === "visible" && router.refresh();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [code, router]);
  return null;
}

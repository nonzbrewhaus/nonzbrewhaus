"use client";

import { useActionState } from "react";
import type { ActionResult } from "@/lib/form";

type Action = (prev: ActionResult | null, fd: FormData) => Promise<ActionResult>;

/** A form that posts to a server action and shows its success/error message underneath. */
export function ActionForm({
  action,
  submitLabel,
  children,
  className = "",
  confirm,
  variant = "primary",
}: {
  action: Action;
  submitLabel: string;
  children?: React.ReactNode;
  className?: string;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`btn btn-${variant}`}>
          {pending ? "Saving…" : submitLabel}
        </button>
        <p role="status" aria-live="polite" className={`text-sm ${state?.ok === false ? "font-semibold text-red-800" : ""}`}>
          {state?.message}
        </p>
      </div>
    </form>
  );
}

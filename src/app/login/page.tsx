import { Suspense } from "react";
import { ActionForm } from "@/components/action-form";
import { sendMagicLink } from "./actions";

const ERRORS: Record<string, string> = {
  not_allowed: "That account isn't allowed into the admin area.",
  link_invalid: "That sign-in link is invalid or expired. Request a new one.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 items-center p-4">
      <div className="card w-full p-6">
        <p className="text-center text-xs tracking-[0.3em]">NONZZ&apos;S BREW HAUS</p>
        <h1 className="mt-2 text-center font-serif text-4xl font-bold italic">Owner sign in</h1>
        <Suspense>
          <ErrorNote searchParams={searchParams} />
        </Suspense>
        <ActionForm action={sendMagicLink} submitLabel="Email me a sign-in link" className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm font-semibold">Email</span>
            <input name="email" type="email" required autoComplete="email" className="field mt-1" />
          </label>
        </ActionForm>
      </div>
    </main>
  );
}

async function ErrorNote({ searchParams }: { searchParams: PageProps<"/login">["searchParams"] }) {
  const { error } = await searchParams;
  const msg = typeof error === "string" ? ERRORS[error] : undefined;
  return msg ? <p role="alert" className="mt-4 rounded-lg bg-cream p-3 text-sm">{msg}</p> : null;
}

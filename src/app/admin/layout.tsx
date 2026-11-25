import Link from "next/link";
import { signOut } from "@/app/login/actions";

const NAV = [
  { href: "/admin", label: "Today" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/menu", label: "Menu" },
  { href: "/admin/schedule", label: "Schedule" },
  { href: "/admin/settings", label: "Settings" },
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto w-full max-w-4xl p-3 sm:p-6">
      <header className="card mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <p className="font-serif text-xl font-bold italic">Nonzz&apos;s · Admin</p>
        <nav aria-label="Admin" className="flex flex-1 flex-wrap gap-1">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 text-sm font-semibold hover:bg-cream">
              {n.label}
            </Link>
          ))}
        </nav>
        <form action={signOut}>
          <button className="btn btn-secondary text-sm">Sign out</button>
        </form>
      </header>
      {children}
    </div>
  );
}

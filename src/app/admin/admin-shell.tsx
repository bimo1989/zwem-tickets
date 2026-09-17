"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/auth";

const TABS = [
  { href: "/admin", label: "Tickets" },
  { href: "/admin/events", label: "Evenementen" },
  { href: "/admin/waitlist", label: "Wachtlijst" },
  { href: "/admin/scan", label: "Check-in" },
  { href: "/admin/reconcile", label: "Bankafschrift" },
  { href: "/admin/settings", label: "Instellingen" },
];

// A volunteer signed in with a scan code only gets the scanner, so don't show
// them tabs they can't open.
const SCANNER_TABS = TABS.filter((tab) => tab.href === "/admin/scan");

export default function AdminShell({
  role,
  children,
}: {
  role: Role | null;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/admin/login") {
    return <>{children}</>;
  }

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  const tabs = role === "scanner" ? SCANNER_TABS : TABS;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <Image
              src="/logo-icon.jpg"
              alt="MC Attawassul"
              width={400}
              height={400}
              className="h-8 w-8 rounded-full"
            />
            <nav className="flex gap-1">
              {tabs.map((tab) => {
                const active =
                  tab.href === "/admin"
                    ? pathname === "/admin"
                    : pathname.startsWith(tab.href);
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                      active
                        ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                        : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    }`}
                  >
                    {tab.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
          >
            Uitloggen
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}

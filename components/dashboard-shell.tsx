"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "./auth-provider";

const activeLinks = [
  ["/dashboard", "Dashboard"],
  ["/teachers", "Teachers"],
  ["/subjects", "Subjects"],
  ["/classes", "Classes"],
  ["/timetable", "Timetable"],
  ["/attendance", "Attendance"],
  ["/fixtures", "Fixtures"],
  ["/records", "Records"],
  ["/whatsapp", "WhatsApp Status"],
  ["/settings", "Settings"],
] as const;

const futureModules: string[] = [];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, router, user]);

  if (loading || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-600">
        Checking your session…
      </main>
    );
  }

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    router.replace("/login");
  };

  return (
    <main className="min-h-screen bg-slate-50 md:flex">
      <aside className="bg-primary p-5 text-white md:flex md:min-h-screen md:w-72 md:flex-col md:p-6">
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">
            School Fixture System
          </p>
          <h1 className="mt-2 text-lg font-bold md:mt-3 md:text-xl">
            {user.school.name}
          </h1>
          <nav className="mt-5 flex gap-2 overflow-x-auto pb-1 md:mt-8 md:block md:space-y-2">
            {activeLinks.map(([href, label]) => (
              <Link
                className={`block whitespace-nowrap rounded-xl px-4 py-2.5 text-sm font-semibold ${
                  pathname === href
                    ? "bg-white/15 text-white"
                    : "text-emerald-50/80 hover:bg-white/10"
                }`}
                href={href}
                key={href}
              >
                {label}
              </Link>
            ))}
            {futureModules.map((module) => (
              <span
                className="hidden px-4 py-2.5 text-sm text-emerald-50/45 md:block"
                key={module}
              >
                {module} <span className="text-xs">(coming later)</span>
              </span>
            ))}
          </nav>
        </div>
        <footer className="mt-6 hidden border-t border-white/15 pt-5 text-xs leading-5 text-emerald-50/75 md:block">
          <p>Developed by M. Aamir Wattoo</p>
          <p>CI, FGPS &amp; College No. 2</p>
        </footer>
      </aside>

      <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8">
        <header className="mb-6 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div>
            <p className="font-bold text-ink">{user.name}</p>
            <p className="text-xs font-medium text-primary">
              {readableRole(user.role)}
            </p>
          </div>
          <button
            className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            disabled={loggingOut}
            onClick={handleLogout}
            type="button"
          >
            {loggingOut ? "Signing out…" : "Logout"}
          </button>
        </header>
        {children}
      </section>
    </main>
  );
}

const readableRole = (role: string) =>
  role
    .toLocaleLowerCase("en")
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

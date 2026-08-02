"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "./auth-provider";

const activeLinks = [["/dashboard", "Dashboard"], ["/teachers", "Teachers"], ["/subjects", "Subjects"], ["/classes", "Classes"], ["/timetable", "Timetable"], ["/timetable/import", "Timetable Import"], ["/attendance", "Attendance"], ["/fixtures", "Fixtures"], ["/records", "Records"], ["/whatsapp", "WhatsApp Status"], ["/settings", "Settings"]] as const;
const readableRole = (role: string) => role.toLocaleLowerCase("en").split("_").map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(" ");

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname(); const router = useRouter(); const { user, loading, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false); const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, router, user]);
  useEffect(() => setNavigationOpen(false), [pathname]);
  if (loading || !user) return <main className="flex min-h-screen items-center justify-center text-slate-600">Loading Proxy Management…</main>;
  const handleLogout = async () => { setLoggingOut(true); await logout(); router.replace("/login"); };
  const navigation = <nav className="mt-5 space-y-1 md:mt-8">{activeLinks.map(([href, label]) => <Link className={`block rounded-xl px-4 py-2.5 text-sm font-semibold ${pathname === href ? "bg-white/15 text-white" : "text-emerald-50/80 hover:bg-white/10"}`} href={href} key={href}>{label}</Link>)}</nav>;
  return <main className="min-h-screen bg-slate-50 md:flex">
    <div className="sticky top-0 z-30 bg-primary px-4 py-3 text-white md:hidden"><div className="flex min-w-0 items-center justify-between gap-3"><div className="min-w-0"><p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">Proxy Management</p><p className="truncate font-bold">{user.school.name}</p></div><button aria-expanded={navigationOpen} aria-label="Toggle navigation" className="shrink-0 rounded-lg border border-white/25 px-3 py-2 text-sm font-semibold" onClick={() => setNavigationOpen((open) => !open)}>Menu</button></div>
      <div className="mt-3 flex min-w-0 items-center justify-between gap-3 rounded-xl bg-white/10 p-3"><div className="min-w-0"><p className="truncate text-sm font-bold">{user.name}</p><p className="truncate text-xs text-emerald-100">{readableRole(user.role)}</p></div><details className="relative shrink-0"><summary className="cursor-pointer list-none rounded-lg bg-white/10 px-3 py-2 text-xs font-semibold">Account</summary><div className="absolute right-0 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-4 text-slate-700 shadow-xl"><p className="truncate font-bold text-ink">{user.name}</p><p className="mt-1 truncate text-xs">{user.email}</p><p className="mt-2 text-xs font-semibold text-primary">{readableRole(user.role)}</p><p className="mt-1 truncate text-xs">{user.school.name}</p><button className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Signing out…" : "Logout"}</button></div></details></div>
      {navigationOpen ? <div className="max-h-[60vh] overflow-y-auto pb-2">{navigation}</div> : null}
    </div>
    <aside className="hidden bg-primary p-6 text-white md:flex md:min-h-screen md:w-72 md:flex-col"><div className="flex-1"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-100">Proxy Management</p><h1 className="mt-3 text-xl font-bold">{user.school.name}</h1>{navigation}</div><footer className="mt-6 border-t border-white/15 pt-5 text-xs leading-5 text-emerald-50/75"><p>Developed by M. Aamir Wattoo</p><p>CI, FGPS &amp; College No. 2</p></footer></aside>
    <section className="min-w-0 flex-1 p-4 sm:p-6 lg:p-8"><header className="mb-6 hidden items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:flex"><div className="min-w-0"><p className="truncate font-bold text-ink">{user.name}</p><p className="text-xs font-medium text-primary">{readableRole(user.role)} · {user.email}</p></div><button className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700" disabled={loggingOut} onClick={() => void handleLogout()}>{loggingOut ? "Signing out…" : "Logout"}</button></header>{children}</section>
  </main>;
}

"use client";

import Link from "next/link";

const tabs = [
  ["class", "/timetable?view=class", "Class View"],
  ["teacher", "/timetable?view=teacher", "Teacher View"],
  ["import", "/timetable/import", "Import Timetable"],
  ["history", "/timetable/history", "Import History"],
] as const;

export function TimetableTabs({ active }: { active: (typeof tabs)[number][0] }) {
  return <nav aria-label="Timetable views" className="timetable-actions mb-5 flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2">{tabs.map(([id, href, label]) => <Link aria-current={active === id ? "page" : undefined} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold ${active === id ? "bg-primary text-white" : "text-slate-600 hover:bg-slate-100"}`} href={href} key={id}>{label}</Link>)}</nav>;
}

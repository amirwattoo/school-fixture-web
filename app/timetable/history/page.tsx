"use client";

import { useEffect, useState } from "react";
import { DashboardShell } from "../../../components/dashboard-shell";
import { TimetableTabs } from "../../../components/timetable-tabs";
import { apiRequest } from "../../../lib/api";

type History = { id: string; status: string; originalFileName: string; fileType: string; importedRows: number; warningCount: number; errorCount: number; importedAt: string | null; createdAt: string };

export default function TimetableHistoryPage() {
  const [history, setHistory] = useState<History[]>([]);
  const [error, setError] = useState("");
  useEffect(() => { apiRequest<{ batches: History[] }>("/timetable-imports").then((data) => setHistory(data.batches), (reason) => setError(reason instanceof Error ? reason.message : "Unable to load import history")); }, []);
  return <DashboardShell><TimetableTabs active="history"/><div className="mb-5"><h2 className="text-2xl font-bold text-ink">Import History</h2><p className="mt-1 text-sm text-slate-600">Recent school-scoped timetable previews and confirmed replacements.</p></div>{error ? <p className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p> : null}<div className="overflow-x-auto rounded-2xl border bg-white"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50"><tr><th className="p-3">File</th><th className="p-3">Status</th><th className="p-3">Rows</th><th className="p-3">Warnings</th><th className="p-3">Errors</th><th className="p-3">Date</th></tr></thead><tbody>{history.map((item) => <tr className="border-t" key={item.id}><td className="p-3 font-semibold">{item.originalFileName} <span className="font-normal text-slate-500">({item.fileType})</span></td><td className="p-3">{item.status}</td><td className="p-3">{item.importedRows}</td><td className="p-3">{item.warningCount}</td><td className="p-3">{item.errorCount}</td><td className="p-3">{new Date(item.importedAt ?? item.createdAt).toLocaleString()}</td></tr>)}</tbody></table>{!error && !history.length ? <p className="p-5 text-sm text-slate-500">No timetable imports yet.</p> : null}</div></DashboardShell>;
}

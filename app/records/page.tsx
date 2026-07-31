"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { inputClass } from "../../components/ui/forms";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest, cachedApiRequest, isAbortError } from "../../lib/api";
import { isoWeekForLocalDate } from "../../lib/date";
import type {
  AttendanceStatus,
  FixtureRecordRow,
  FixtureStatus,
  Pagination,
  Teacher,
} from "../../lib/school-types";

type Tab = "weekly" | "yearly" | "history" | "attendance";
type HistoryFixture = {
  id: string;
  date: string;
  periodNumber: number;
  status: FixtureStatus;
  isManuallyOverridden: boolean;
  classSection: { name: string };
  subject: { name: string; code: string };
  absentTeacher: { name: string; employeeCode: string };
};
type AttendanceReportRow = {
  id: string;
  date: string;
  exceptionType: Exclude<AttendanceStatus, "PRESENT">;
  availablePeriods: number[];
  unavailablePeriods: number[];
  reason: string | null;
  notes: string | null;
  fixturesGenerated: number;
  teacher: { id: string; name: string; employeeCode: string };
};

export default function RecordsPage() {
  const currentWeek = isoWeekForLocalDate();
  const [tab, setTab] = useState<Tab>("weekly");
  const [year, setYear] = useState(currentWeek.year);
  const [week, setWeek] = useState(currentWeek.weekNumber);
  const [sort, setSort] = useState("name");
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [records, setRecords] = useState<FixtureRecordRow[]>([]);
  const [history, setHistory] = useState<HistoryFixture[]>([]);
  const [attendance, setAttendance] = useState<AttendanceReportRow[]>([]);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    cachedApiRequest<{ teachers: Teacher[] }>("/teachers")
      .then((data) => {
        setTeachers(data.teachers);
        setTeacherId((value) => value || data.teachers[0]?.id || "");
      })
      .catch((loadError: unknown) =>
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load teachers",
        ),
      );
  }, []);

  const load = useCallback(async (signal?: AbortSignal) => {
    if (tab === "history" && !teacherId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (tab === "weekly") {
        setPagination(null);
        const data = await apiRequest<{ records: FixtureRecordRow[] }>(
          `/records/weekly?year=${year}&week=${week}&sort=${sort}`,
          { signal },
        );
        setRecords(data.records);
      } else if (tab === "yearly") {
        setPagination(null);
        const data = await apiRequest<{ records: FixtureRecordRow[] }>(
          `/records/yearly?year=${year}&sort=${sort}`,
          { signal },
        );
        setRecords(data.records);
      } else if (tab === "history") {
        const query = new URLSearchParams();
        if (from) query.set("from", from);
        if (to) query.set("to", to);
        if (!from && !to) query.set("year", String(year));
        query.set("page", String(page));
        query.set("pageSize", "100");
        const data = await apiRequest<{
          fixtures: HistoryFixture[];
          pagination: Pagination;
        }>(
          `/records/teachers/${teacherId}?${query.toString()}`,
          { signal },
        );
        setHistory(data.fixtures);
        setPagination(data.pagination);
      } else {
        const query = new URLSearchParams();
        if (from) query.set("from", from);
        if (to) query.set("to", to);
        if (!from && !to) query.set("year", String(year));
        query.set("page", String(page));
        query.set("pageSize", "100");
        const data = await apiRequest<{
          records: AttendanceReportRow[];
          pagination: Pagination;
        }>(
          `/records/attendance?${query.toString()}`,
          { signal },
        );
        setAttendance(data.records);
        setPagination(data.pagination);
      }
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load records",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [from, page, sort, tab, teacherId, to, week, year]);

  useEffect(() => setPage(1), [from, tab, teacherId, to, year]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const empty =
    tab === "history"
      ? history.length === 0
      : tab === "attendance"
        ? attendance.length === 0
        : records.length === 0;

  return (
    <DashboardShell>
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-ink">Fixture Records</h2>
        <p className="mt-1 text-sm text-slate-600">
          Weekly workload, calculated yearly totals, and teacher history.
        </p>
      </div>
      <div className="mb-5 flex flex-wrap gap-2">
        {(["weekly", "yearly", "history", "attendance"] as const).map(
          (item) => (
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                tab === item
                  ? "bg-primary text-white"
                  : "bg-slate-200 text-slate-700"
              }`}
              key={item}
              onClick={() => setTab(item)}
              type="button"
            >
              {item === "history"
                ? "Teacher History"
                : item === "attendance"
                  ? "Attendance Exceptions"
                  : `${item.charAt(0).toUpperCase()}${item.slice(1)}`}
            </button>
          ),
        )}
      </div>
      <div className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
        {tab === "history" ? (
          <select
            className={inputClass}
            onChange={(event) => setTeacherId(event.target.value)}
            value={teacherId}
          >
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.employeeCode})
              </option>
            ))}
          </select>
        ) : null}
        <input
          className={inputClass}
          min="2000"
          onChange={(event) => setYear(Number(event.target.value))}
          type="number"
          value={year}
        />
        {tab === "weekly" ? (
          <input
            className={inputClass}
            max="53"
            min="1"
            onChange={(event) => setWeek(Number(event.target.value))}
            type="number"
            value={week}
          />
        ) : null}
        {tab === "weekly" || tab === "yearly" ? (
          <select
            className={inputClass}
            onChange={(event) => setSort(event.target.value)}
            value={sort}
          >
            <option value="name">Teacher name</option>
            <option value="highest">Highest count</option>
            <option value="lowest">Lowest count</option>
          </select>
        ) : tab === "history" || tab === "attendance" ? (
          <>
            <input
              className={inputClass}
              onChange={(event) => setFrom(event.target.value)}
              title="From date"
              type="date"
              value={from}
            />
            <input
              className={inputClass}
              onChange={(event) => setTo(event.target.value)}
              title="To date"
              type="date"
              value={to}
            />
          </>
        ) : null}
      </div>
      <PageFeedback
        empty={empty}
        error={error}
        loading={loading && empty}
        onRetry={() => void load()}
      />
      {!error && !empty ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          {tab === "history" ? (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Date",
                    "Period",
                    "Class",
                    "Subject",
                    "Absent",
                    "Status",
                    "Assignment",
                  ].map((heading) => (
                    <th className="px-4 py-3" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((fixture) => (
                  <tr key={fixture.id}>
                    <td className="px-4 py-3">{fixture.date.slice(0, 10)}</td>
                    <td className="px-4 py-3">{fixture.periodNumber}</td>
                    <td className="px-4 py-3">{fixture.classSection.name}</td>
                    <td className="px-4 py-3">{fixture.subject.name}</td>
                    <td className="px-4 py-3">{fixture.absentTeacher.name}</td>
                    <td className="px-4 py-3">{fixture.status}</td>
                    <td className="px-4 py-3">
                      {fixture.isManuallyOverridden
                        ? "Manual override"
                        : "Automatic"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : tab === "attendance" ? (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  {[
                    "Teacher",
                    "Date",
                    "Exception",
                    "Available periods",
                    "Unavailable periods",
                    "Reason / Notes",
                    "Fixtures generated",
                  ].map((heading) => (
                    <th className="px-4 py-3" key={heading}>
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {attendance.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3">
                      <p className="font-semibold">{record.teacher.name}</p>
                      <p className="text-xs text-slate-500">
                        {record.teacher.employeeCode}
                      </p>
                    </td>
                    <td className="px-4 py-3">{record.date.slice(0, 10)}</td>
                    <td className="px-4 py-3">
                      {record.exceptionType.replaceAll("_", " ")}
                    </td>
                    <td className="px-4 py-3">
                      {record.availablePeriods.join(", ") || "None"}
                    </td>
                    <td className="px-4 py-3">
                      {record.unavailablePeriods.join(", ") || "None"}
                    </td>
                    <td className="px-4 py-3">
                      <p>{record.reason || "—"}</p>
                      {record.notes ? (
                        <p className="text-xs text-slate-500">{record.notes}</p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">
                      {record.fixturesGenerated}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Teacher</th>
                  <th className="px-4 py-3">Employee code</th>
                  <th className="px-4 py-3">Fixture count</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {records.map((record) => (
                  <tr key={record.teacherId}>
                    <td className="px-4 py-3 font-semibold">
                      {record.teacherName}
                    </td>
                    <td className="px-4 py-3">{record.employeeCode}</td>
                    <td className="px-4 py-3 text-lg font-bold">
                      {record.fixtureCount}
                    </td>
                    <td className="px-4 py-3">
                      {record.isActive ? "Active" : "Inactive"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
      {pagination && pagination.totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-white p-3 text-sm">
          <button
            className="font-semibold text-primary disabled:text-slate-300"
            disabled={loading || page <= 1}
            onClick={() => setPage((value) => value - 1)}
            type="button"
          >
            Previous
          </button>
          <span>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="font-semibold text-primary disabled:text-slate-300"
            disabled={loading || page >= pagination.totalPages}
            onClick={() => setPage((value) => value + 1)}
            type="button"
          >
            Next
          </button>
        </div>
      ) : null}
    </DashboardShell>
  );
}

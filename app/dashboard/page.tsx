"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest } from "../../lib/api";
import { isoWeekForLocalDate, localDateValue } from "../../lib/date";
import type {
  AttendanceRecord,
  FixtureRecordRow,
  ProxyFixture,
} from "../../lib/school-types";

type Summary = {
  absent: number;
  drafts: number;
  published: number;
  unassigned: number;
  weekly: number;
  messagesReady: number;
  messagesOpened: number;
  messagesConfirmed: number;
};

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const date = localDateValue();
    const { year, weekNumber } = isoWeekForLocalDate();
    try {
      const [attendance, fixtures, weekly, ready, opened, confirmed] =
        await Promise.all([
          apiRequest<{ records: AttendanceRecord[] }>(
            `/attendance?date=${date}`,
          ),
          apiRequest<{ fixtures: ProxyFixture[] }>(`/fixtures?date=${date}`),
          apiRequest<{ records: FixtureRecordRow[] }>(
            `/records/weekly?year=${year}&week=${weekNumber}`,
          ),
          apiRequest<{ pagination: { total: number } }>(
            `/whatsapp-notifications?date=${date}&status=READY&pageSize=1`,
          ),
          apiRequest<{ pagination: { total: number } }>(
            `/whatsapp-notifications?date=${date}&status=OPENED&pageSize=1`,
          ),
          apiRequest<{ pagination: { total: number } }>(
            `/whatsapp-notifications?date=${date}&status=MANUALLY_CONFIRMED&pageSize=1`,
          ),
        ]);
      setSummary({
        absent: attendance.records.filter(
          (record) => record.status === "ABSENT",
        ).length,
        drafts: fixtures.fixtures.filter(
          (fixture) => fixture.status === "DRAFT",
        ).length,
        published: fixtures.fixtures.filter(
          (fixture) => fixture.status === "PUBLISHED",
        ).length,
        unassigned: fixtures.fixtures.filter(
          (fixture) => fixture.status === "DRAFT" && !fixture.assignedTeacherId,
        ).length,
        weekly: weekly.records.reduce(
          (total, record) => total + record.fixtureCount,
          0,
        ),
        messagesReady: ready.pagination.total,
        messagesOpened: opened.pagination.total,
        messagesConfirmed: confirmed.pagination.total,
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dashboard",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardShell>
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-wider text-primary">
          Phase 4
        </p>
        <h2 className="mt-1 text-2xl font-bold text-ink">
          Daily fixture overview
        </h2>
      </div>
      <PageFeedback
        empty={false}
        error={error}
        loading={loading}
        onRetry={load}
      />
      {summary && !loading && !error ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Today's absent teachers", summary.absent],
            ["Today's draft fixtures", summary.drafts],
            ["Today's published fixtures", summary.published],
            ["Today's unassigned fixtures", summary.unassigned],
            ["Current ISO-week fixtures", summary.weekly],
            ["Today's WhatsApp messages ready", summary.messagesReady],
            ["Today's WhatsApp chats opened", summary.messagesOpened],
            ["Today's manually confirmed messages", summary.messagesConfirmed],
          ].map(([label, value]) => (
            <section
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              key={label}
            >
              <p className="text-sm leading-5 text-slate-500">{label}</p>
              <p className="mt-3 text-3xl font-bold text-ink">{value}</p>
            </section>
          ))}
        </div>
      ) : null}
    </DashboardShell>
  );
}

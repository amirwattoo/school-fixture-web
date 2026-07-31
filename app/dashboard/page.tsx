"use client";

import { useCallback, useEffect, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest, isAbortError } from "../../lib/api";
import { localDateValue } from "../../lib/date";

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

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    const date = localDateValue();
    try {
      const data = await apiRequest<{ summary: Summary }>(
        `/dashboard?date=${date}`,
        { signal },
      );
      setSummary(data.summary);
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load dashboard",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
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
        loading={loading && !summary}
        onRetry={load}
      />
      {summary && !error ? (
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

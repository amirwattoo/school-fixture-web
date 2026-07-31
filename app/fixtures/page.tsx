"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DashboardShell } from "../../components/dashboard-shell";
import {
  Field,
  FormActions,
  inputClass,
  linkButton,
  primaryButton,
} from "../../components/ui/forms";
import { Modal } from "../../components/ui/modal";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest, isAbortError } from "../../lib/api";
import { localDateValue } from "../../lib/date";
import type {
  AttendanceRecord,
  ExcludedFixtureTeacher,
  ProxyFixture,
  ScoringDetails as FixtureScoringDetails,
  ScoredCandidate,
} from "../../lib/school-types";

type PublicationResult = {
  fixtures: ProxyFixture[];
  publishedCount: number;
  notificationsCreated: number;
  messagesReady: number;
  messagesSent: number;
  messagesFailed: number;
  existingNotifications: number;
};

type FixtureGenerationResponse = {
  fixtures: ProxyFixture[];
  diagnostics?: {
    selectedDate: string;
    resolvedWeekday: string;
    unavailableTeacherCount: number;
    matchingTimetablePeriodCount: number;
    existingFixtureCount: number;
    skippedReasons: string[];
  };
};

const hasValidPakistaniNumber = (value: string | null) =>
  Boolean(value && /^(?:\+?92|0)3\d{9}$/.test(value.replace(/[\s()-]/g, "")));

export default function FixturesPage() {
  const [date, setDate] = useState(localDateValue());
  const [fixtures, setFixtures] = useState<ProxyFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [overriding, setOverriding] = useState<ProxyFixture | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const fixtureData = await apiRequest<{ fixtures: ProxyFixture[] }>(
        `/fixtures?date=${date}`,
        { signal },
      );
      setFixtures(fixtureData.fixtures);
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load fixtures",
      );
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const generate = async () => {
    setWorking(true);
    setError("");
    try {
      const attendance = await apiRequest<{ records: AttendanceRecord[] }>(
        `/attendance?date=${date}`,
      );
      const absentTeacherIds = attendance.records
        .filter((record) => record.status !== "PRESENT")
        .map((record) => record.teacherId);
      if (!absentTeacherIds.length) {
        setError("No attendance exceptions are saved for this date.");
        return;
      }
      const result = await apiRequest<FixtureGenerationResponse>(
        "/fixtures/generate",
        {
          method: "POST",
          body: JSON.stringify({ date, absentTeacherIds }),
        },
      );
      setSuccess(
        result.fixtures.length
          ? `${result.fixtures.length} fixtures are ready and weekly workloads are updated.`
          : `No fixtures generated for ${result.diagnostics?.selectedDate ?? date} (${result.diagnostics?.resolvedWeekday ?? "unknown weekday"}). ${result.diagnostics?.skippedReasons.join(" ") ?? ""}`.trim(),
      );
      await load();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate fixtures",
      );
    } finally {
      setWorking(false);
    }
  };

  const publish = async () => {
    const missingNumbers = fixtures
      .filter(
        (fixture) =>
          fixture.status === "DRAFT" &&
          fixture.assignedTeacher &&
          !hasValidPakistaniNumber(fixture.assignedTeacher.whatsappNumber),
      )
      .map((fixture) => fixture.assignedTeacher!.name);
    const numberWarning = missingNumbers.length
      ? `\n\nNo valid WhatsApp number is saved for: ${[...new Set(missingNumbers)].join(", ")}. Publication will continue, but those notifications will fail.`
      : "";
    if (
      !window.confirm(
        `Publish every assigned draft fixture for this date?\n\nAssigned teachers will receive WhatsApp fixture messages.${numberWarning}`,
      )
    )
      return;
    setWorking(true);
    setError("");
    try {
      const result = await apiRequest<PublicationResult>("/fixtures/publish", {
        method: "POST",
        body: JSON.stringify({ date }),
      });
      setSuccess(
        `${result.publishedCount} fixtures published. ${result.messagesReady} WhatsApp messages are ready to open manually.`,
      );
      await load();
    } catch (publishError) {
      setError(
        publishError instanceof Error
          ? publishError.message
          : "Unable to publish fixtures",
      );
    } finally {
      setWorking(false);
    }
  };

  const cancel = async (fixture: ProxyFixture) => {
    if (!window.confirm(`Cancel the fixture for ${fixture.classSection.name}?`))
      return;
    try {
      await apiRequest(`/fixtures/${fixture.id}/cancel`, { method: "POST" });
      await load();
    } catch (cancelError) {
      setError(
        cancelError instanceof Error
          ? cancelError.message
          : "Unable to cancel fixture",
      );
    }
  };

  return (
    <DashboardShell>
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Fixture Review</h2>
          <p className="mt-1 text-sm text-slate-600">
            Review automatic scores, override drafts, and publish when assigned.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-semibold text-slate-700">
            Date
            <input
              className={`${inputClass} mt-1`}
              onChange={(event) => setDate(event.target.value)}
              type="date"
              value={date}
            />
          </label>
          <button
            className={primaryButton}
            disabled={working}
            onClick={() => void generate()}
            type="button"
          >
            Generate Fixtures
          </button>
          <button
            className={primaryButton}
            disabled={
              working || !fixtures.some((item) => item.status === "DRAFT")
            }
            onClick={() => void publish()}
            type="button"
          >
            Publish Drafts
          </button>
        </div>
      </div>
      {success ? (
        <div className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          <p>{success}</p>
          <Link
            className="mt-1 inline-block font-bold underline"
            href="/whatsapp"
          >
            View WhatsApp Status
          </Link>
        </div>
      ) : null}
      {fixtures.some(
        (fixture) => fixture.status === "DRAFT" && !fixture.assignedTeacherId,
      ) ? (
        <p className="mb-4 rounded-xl bg-amber-50 p-3 text-sm font-medium text-amber-900">
          Unassigned draft fixtures require a manual override before publishing.
        </p>
      ) : null}
      {fixtures.some(
        (fixture) => fixture.status === "DRAFT" && fixture.requiresReassignment,
      ) ? (
        <p className="mb-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-800">
          Attendance changes made one or more draft fixtures unavailable.
          Reassign every flagged fixture before publishing.
        </p>
      ) : null}
      <PageFeedback
        empty={!fixtures.length}
        error={error}
        loading={loading && !fixtures.length}
        onRetry={() => void load()}
      />
      {!error && fixtures.length ? (
        <div className="space-y-4">
          {fixtures.map((fixture) => (
            <section
              className="rounded-2xl border border-slate-200 bg-white p-4"
              key={fixture.id}
            >
              <div className="grid gap-3 md:grid-cols-[5rem_1fr_1fr_1fr_auto] md:items-center">
                <div>
                  <p className="text-xs text-slate-500">Period</p>
                  <p className="text-xl font-bold">{fixture.periodNumber}</p>
                </div>
                <div>
                  <p className="font-semibold">{fixture.classSection.name}</p>
                  <p className="text-sm text-slate-500">
                    {fixture.subject.name}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Absent</p>
                  <p>{fixture.absentTeacher.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Assigned</p>
                  <p
                    className={
                      fixture.assignedTeacher
                        ? "font-semibold text-emerald-800"
                        : "font-bold text-amber-700"
                    }
                  >
                    {fixture.assignedTeacher?.name ?? "UNASSIGNED"}
                  </p>
                  <p className="text-xs text-slate-500">
                    Score: {fixture.autoScore ?? "—"} · {fixture.status}
                    {fixture.isManuallyOverridden ? " · Overridden" : ""}
                  </p>
                  {fixture.requiresReassignment ? (
                    <p className="mt-1 text-xs font-bold text-red-700">
                      Reassignment required: {fixture.reassignmentReason}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-3">
                  {fixture.status === "DRAFT" ? (
                    <>
                      <button
                        className={linkButton}
                        onClick={() => setOverriding(fixture)}
                        type="button"
                      >
                        Override
                      </button>
                      <button
                        className={`${linkButton} text-red-700`}
                        onClick={() => void cancel(fixture)}
                        type="button"
                      >
                        Cancel
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <ScoringDetails fixture={fixture} />
            </section>
          ))}
        </div>
      ) : null}
      {overriding ? (
        <OverrideModal
          fixture={overriding}
          onClose={() => setOverriding(null)}
          onSaved={async () => {
            setOverriding(null);
            await load();
          }}
        />
      ) : null}
    </DashboardShell>
  );
}

function ScoringDetails({ fixture }: { fixture: ProxyFixture }) {
  const [details, setDetails] = useState<FixtureScoringDetails | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setDetails(null);
    setLoaded(false);
    setError("");
  }, [fixture.id]);

  const loadScoring = async () => {
    if (loaded || loading) return;
    setLoading(true);
    setError("");
    try {
      const result = await apiRequest<{
        scoringDetails: FixtureScoringDetails;
      }>(`/fixtures/${fixture.id}/scoring`);
      setDetails(result.scoringDetails);
      setLoaded(true);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load scoring details",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <details
      className="mt-4 border-t border-slate-100 pt-3"
      onToggle={(event) => {
        if (event.currentTarget.open) void loadScoring();
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold text-primary">
        Scoring details
      </summary>
      <div className="mt-3 overflow-x-auto">
        {loading ? (
          <p className="text-sm text-slate-500">Loading current scoring…</p>
        ) : null}
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        {!details ? (
          <p className="text-sm text-amber-700">
            No scoring details are available.
          </p>
        ) : null}
        {details ? (
          <>
            <p className="mb-2 text-xs text-slate-500">
              Required: {details.requiredSubject} ·{" "}
              {details.requiredTeachingLevel}
            </p>
            {details.candidates.length ? (
              <table className="min-w-full text-left text-xs">
                <thead>
                  <tr className="text-slate-500">
                    {[
                      "Candidate",
                      "Subject",
                      "Level",
                      "Official",
                      "Fixtures",
                      "Effective",
                      "Min / Max",
                      "Workload score",
                      "Total",
                    ].map((heading) => (
                      <th className="pr-4 py-2" key={heading}>
                        {heading}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {details.candidates.map((candidate) => (
                    <tr key={candidate.teacherId}>
                      <td className="pr-4 py-2 font-semibold">
                        {candidate.teacherName}
                      </td>
                      <td className="pr-4">{candidate.subjectScore}</td>
                      <td className="pr-4">{candidate.classLevelScore}</td>
                      <td className="pr-4">
                        {candidate.baseWeeklyTeachingPeriods}
                      </td>
                      <td className="pr-4">{candidate.weeklyFixtureCount}</td>
                      <td className="pr-4">
                        {candidate.effectiveWeeklyWorkload}
                      </td>
                      <td className="pr-4">
                        {candidate.minimumEligibleWorkload} /{" "}
                        {candidate.maximumEligibleWorkload}
                      </td>
                      <td className="pr-4">{candidate.workloadScore}</td>
                      <td className="font-bold">{candidate.totalScore}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-amber-700">No eligible candidates.</p>
            )}
          </>
        ) : null}
      </div>
    </details>
  );
}

const overrideSchema = z.object({
  assignedTeacherId: z.string().min(1, "Select a teacher"),
  reason: z.string().trim().min(3, "Reason is required"),
});
type OverrideForm = z.infer<typeof overrideSchema>;

function OverrideModal({
  fixture,
  onClose,
  onSaved,
}: {
  fixture: ProxyFixture;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [serverError, setServerError] = useState("");
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<ScoredCandidate[]>([]);
  const [excluded, setExcluded] = useState<ExcludedFixtureTeacher[]>([]);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<OverrideForm>({
    resolver: zodResolver(overrideSchema),
    defaultValues: {
      assignedTeacherId: "",
      reason: fixture.overrideReason ?? "",
    },
  });

  useEffect(() => {
    const loadCandidates = async () => {
      try {
        const result = await apiRequest<{
          candidates: ScoredCandidate[];
          excluded: ExcludedFixtureTeacher[];
        }>(`/fixtures/${fixture.id}/candidates`);
        setCandidates(result.candidates);
        setExcluded(result.excluded);
        setValue("assignedTeacherId", result.candidates[0]?.teacherId ?? "");
      } catch (candidateError) {
        setServerError(
          candidateError instanceof Error
            ? candidateError.message
            : "Unable to load eligible teachers",
        );
      } finally {
        setLoading(false);
      }
    };
    void loadCandidates();
  }, [fixture.id, setValue]);

  const submit = async (values: OverrideForm) => {
    setServerError("");
    try {
      await apiRequest(`/fixtures/${fixture.id}/override`, {
        method: "PATCH",
        body: JSON.stringify(values),
      });
      await onSaved();
    } catch (submitError) {
      setServerError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to override fixture",
      );
    }
  };

  return (
    <Modal onClose={onClose} title={`Override ${fixture.classSection.name}`}>
      <form className="grid gap-4" onSubmit={handleSubmit(submit)}>
        <Field error={errors.assignedTeacherId?.message} label="Teacher">
          <select
            className={inputClass}
            disabled={loading || !candidates.length}
            {...register("assignedTeacherId")}
          >
            {candidates.map((candidate) => (
              <option key={candidate.teacherId} value={candidate.teacherId}>
                {candidate.teacherName} — Subject {candidate.subjectScore} |
                Level {candidate.classLevelScore} | Official{" "}
                {candidate.baseWeeklyTeachingPeriods} | Fixtures{" "}
                {candidate.weeklyFixtureCount} | Effective{" "}
                {candidate.effectiveWeeklyWorkload} | Workload score{" "}
                {candidate.workloadScore} | Total {candidate.totalScore}
              </option>
            ))}
          </select>
        </Field>
        {!loading && !candidates.length ? (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
            No eligible free teacher is available for this lesson.
          </p>
        ) : null}
        {excluded.length ? (
          <details className="text-xs text-slate-500">
            <summary className="cursor-pointer font-semibold">
              Why other teachers were excluded
            </summary>
            <ul className="mt-2 space-y-1">
              {excluded.map((teacher) => (
                <li key={teacher.teacherId}>
                  {teacher.teacherName}: {teacher.reason}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        <Field error={errors.reason?.message} label="Reason">
          <textarea className={inputClass} rows={3} {...register("reason")} />
        </Field>
        {serverError ? (
          <p className="text-sm text-red-700">{serverError}</p>
        ) : null}
        <FormActions
          isSubmitting={isSubmitting || loading || !candidates.length}
          onCancel={onClose}
          submitLabel="Save override"
        />
      </form>
    </Modal>
  );
}

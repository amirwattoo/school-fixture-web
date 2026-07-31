"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardShell } from "../../components/dashboard-shell";
import {
  inputClass,
  linkButton,
  primaryButton,
} from "../../components/ui/forms";
import { Modal } from "../../components/ui/modal";
import { PageFeedback } from "../../components/ui/page-feedback";
import {
  ApiClientError,
  apiRequest,
  cachedApiRequest,
  isAbortError,
} from "../../lib/api";
import { localDateValue } from "../../lib/date";
import {
  type AttendanceRecord,
  type AttendanceStatus,
  readableEnum,
  type Teacher,
} from "../../lib/school-types";

type AttendanceSummary = {
  absent: number;
  onLeave: number;
  late: number;
  firstHalfLeave: number;
  secondHalfLeave: number;
  shortLeave: number;
  partialDay: number;
  presentByDefault: number;
};

type AttendanceSettings = {
  periodsPerDay: number;
  halfDayBoundaryPeriod: number;
};

type AttendanceResponse = {
  records: AttendanceRecord[];
  summary: AttendanceSummary;
  settings: AttendanceSettings;
};

type SaveResponse = {
  affectedDraftFixtureIds: string[];
  affectedPublishedFixtureIds: string[];
  fixtureGeneration: {
    affectedLessons: number;
    fixturesCreated: number;
    fixturesAlreadyExisting: number;
    fixturesWithoutEligibleReplacement: number;
  };
};

type FixtureGenerationResponse = {
  fixtures: unknown[];
  diagnostics: {
    selectedDate: string;
    resolvedWeekday: string;
    unavailableTeacherCount: number;
    matchingTimetablePeriodCount: number;
    existingFixtureCount: number;
    skippedReasons: string[];
  };
};

const exceptionStatuses: Exclude<AttendanceStatus, "PRESENT">[] = [
  "ABSENT",
  "LEAVE",
  "LATE",
  "SHORT_LEAVE",
  "PARTIAL_DAY",
];

const periodList = (periods: number[]) =>
  periods.length ? `Lessons ${periods.join(", ")}` : "None";

const availabilityFor = (record: AttendanceRecord, periodsPerDay: number) => {
  const available: number[] = [];
  const unavailable: number[] = [];
  for (let period = 1; period <= periodsPerDay; period += 1) {
    const isUnavailable =
      record.status === "ABSENT" ||
      record.status === "LEAVE" ||
      (record.status === "LATE" &&
        period < (record.availableFromPeriod ?? 1)) ||
      (record.status === "SHORT_LEAVE" &&
        period >= (record.unavailableFromPeriod ?? periodsPerDay + 1)) ||
      (record.status === "PARTIAL_DAY" &&
        ((record.availableFromPeriod !== null &&
          period < record.availableFromPeriod) ||
          (record.unavailableFromPeriod !== null &&
            period >= record.unavailableFromPeriod)));
    (isUnavailable ? unavailable : available).push(period);
  }
  return { available, unavailable };
};

export default function AttendancePage() {
  const [date, setDate] = useState(localDateValue());
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [settings, setSettings] = useState<AttendanceSettings>({
    periodsPerDay: 8,
    halfDayBoundaryPeriod: 5,
  });
  const [editing, setEditing] = useState<AttendanceRecord | null | undefined>();
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    setError("");
    try {
      const [teacherData, attendanceData] = await Promise.all([
        cachedApiRequest<{ teachers: Teacher[] }>("/teachers?isActive=true"),
        apiRequest<AttendanceResponse>(`/attendance?date=${date}`, { signal }),
      ]);
      setTeachers(teacherData.teachers);
      setRecords(attendanceData.records);
      setSummary(attendanceData.summary);
      setSettings(attendanceData.settings);
    } catch (loadError) {
      if (isAbortError(loadError)) return;
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load attendance exceptions",
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

  const availableTeachers = useMemo(() => {
    const recorded = new Set(records.map((record) => record.teacherId));
    return teachers.filter((teacher) => !recorded.has(teacher.id));
  }, [records, teachers]);

  const generate = async () => {
    const teacherIds = records
      .filter((record) => record.status !== "PRESENT")
      .map((record) => record.teacherId);
    if (!teacherIds.length) {
      setError("No attendance exceptions are recorded for this date.");
      return;
    }
    setGenerating(true);
    setError("");
    try {
      const result = await apiRequest<FixtureGenerationResponse>(
        "/fixtures/generate",
        {
          method: "POST",
          body: JSON.stringify({ date, absentTeacherIds: teacherIds }),
        },
      );
      setSuccess(
        result.fixtures.length
          ? `${result.fixtures.length} affected lessons are ready for fixture review.`
          : `No fixtures generated for ${result.diagnostics.selectedDate} (${result.diagnostics.resolvedWeekday}). ${result.diagnostics.skippedReasons.join(" ")}`.trim(),
      );
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Unable to generate fixtures",
      );
    } finally {
      setGenerating(false);
    }
  };

  const remove = async (record: AttendanceRecord) => {
    if (!window.confirm(`Remove the exception for ${record.teacher.name}?`))
      return;
    try {
      await apiRequest(`/attendance/${record.teacherId}?date=${date}`, {
        method: "DELETE",
      });
      setSuccess(`${record.teacher.name} is now present by default.`);
      await load();
    } catch (removeError) {
      setError(
        removeError instanceof Error
          ? removeError.message
          : "Unable to remove attendance exception",
      );
    }
  };

  return (
    <DashboardShell>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-ink">Daily Attendance</h2>
          <p className="mt-1 text-sm text-slate-600">
            Teachers are present by default. Record only exceptions.
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
            disabled={!availableTeachers.length}
            onClick={() => setEditing(null)}
            type="button"
          >
            Add Attendance Exception
          </button>
          <button
            className={primaryButton}
            disabled={generating || records.length === 0}
            onClick={() => void generate()}
            type="button"
          >
            {generating ? "Generating…" : "Generate Fixtures"}
          </button>
        </div>
      </div>

      {summary ? (
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Absent", summary.absent],
            ["On Full-Day Leave", summary.onLeave],
            ["Late", summary.late],
            ["First Half Leave", summary.firstHalfLeave],
            ["Second Half Leave", summary.secondHalfLeave],
            ["Short Leave", summary.shortLeave],
            ["Custom Partial Day", summary.partialDay],
            ["Present by Default", summary.presentByDefault],
          ].map(([label, value]) => (
            <section
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={label}
            >
              <p className="text-xs text-slate-500">{label}</p>
              <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
            </section>
          ))}
        </div>
      ) : null}
      {success ? (
        <p className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
          {success}
        </p>
      ) : null}
      <PageFeedback
        empty={!records.length}
        error={error}
        loading={loading && !records.length}
        onRetry={() => void load()}
      />
      {records.length ? (
        <div className="space-y-3">
          {records.map((record) => {
            const periods = availabilityFor(record, settings.periodsPerDay);
            return (
              <section
                className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_14rem_1fr_auto] sm:items-center"
                key={record.id}
              >
                <div>
                  <p className="font-semibold text-ink">
                    {record.teacher.name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {record.teacher.employeeCode}
                  </p>
                </div>
                <div>
                  <p className="font-semibold">{readableEnum(record.status)}</p>
                  <p className="text-xs text-emerald-700">
                    Available: {periodList(periods.available)}
                  </p>
                  <p className="text-xs text-red-700">
                    Unavailable: {periodList(periods.unavailable)}
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  <p>
                    {record.reason ?? record.remarks ?? "No reason provided"}
                  </p>
                  {record.notes ? (
                    <p className="mt-1 text-xs">{record.notes}</p>
                  ) : null}
                </div>
                <div className="whitespace-nowrap">
                  <button
                    className={linkButton}
                    onClick={() => setEditing(record)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className={`${linkButton} ml-3 text-red-700`}
                    onClick={() => void remove(record)}
                    type="button"
                  >
                    Remove
                  </button>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}
      {editing !== undefined ? (
        <AttendanceExceptionModal
          date={date}
          existing={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async (result) => {
            setEditing(undefined);
            const generated = result.fixtureGeneration;
            const messages = [
              `${generated.affectedLessons} affected lesson(s)`,
              `${generated.fixturesCreated} fixture(s) created`,
              `${generated.fixturesAlreadyExisting} already existing`,
              `${generated.fixturesWithoutEligibleReplacement} without an eligible replacement`,
              result.affectedDraftFixtureIds.length
                ? `${result.affectedDraftFixtureIds.length} draft assignment(s) require reassignment`
                : "",
              result.affectedPublishedFixtureIds.length
                ? `URGENT: ${result.affectedPublishedFixtureIds.length} published assignment(s) require explicit review`
                : "",
            ].filter(Boolean);
            setSuccess(messages.join(". "));
            await load();
          }}
          settings={settings}
          teachers={editing ? teachers : availableTeachers}
        />
      ) : null}
    </DashboardShell>
  );
}

type Preset =
  | "FIRST_HALF_LEAVE"
  | "SECOND_HALF_LEAVE"
  | "CUSTOM_SHORT_LEAVE"
  | "LATE_ARRIVAL"
  | "CUSTOM_PARTIAL_DAY";

function AttendanceExceptionModal({
  date,
  existing,
  teachers,
  settings,
  onClose,
  onSaved,
}: {
  date: string;
  existing: AttendanceRecord | null;
  teachers: Teacher[];
  settings: AttendanceSettings;
  onClose: () => void;
  onSaved: (result: SaveResponse) => Promise<void>;
}) {
  const [teacherId, setTeacherId] = useState(
    existing?.teacherId ?? teachers[0]?.id ?? "",
  );
  const [status, setStatus] = useState<Exclude<AttendanceStatus, "PRESENT">>(
    existing && existing.status !== "PRESENT" ? existing.status : "ABSENT",
  );
  const [preset, setPreset] = useState<Preset | "">(() => {
    if (
      existing?.status === "PARTIAL_DAY" &&
      existing.availableFromPeriod === settings.halfDayBoundaryPeriod &&
      existing.unavailableFromPeriod === null
    )
      return "FIRST_HALF_LEAVE";
    if (
      existing?.status === "PARTIAL_DAY" &&
      existing.availableFromPeriod === null &&
      existing.unavailableFromPeriod === settings.halfDayBoundaryPeriod
    )
      return "SECOND_HALF_LEAVE";
    return "";
  });
  const [availableFromPeriod, setAvailableFromPeriod] = useState(
    existing?.availableFromPeriod ?? 3,
  );
  const [unavailableFromPeriod, setUnavailableFromPeriod] = useState(
    existing?.unavailableFromPeriod ?? 7,
  );
  const [reason, setReason] = useState(
    existing?.reason ?? existing?.remarks ?? "",
  );
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const applyPreset = (value: Preset | "") => {
    setPreset(value);
    if (value === "FIRST_HALF_LEAVE") {
      setStatus("PARTIAL_DAY");
      setAvailableFromPeriod(settings.halfDayBoundaryPeriod);
    } else if (value === "SECOND_HALF_LEAVE") {
      setStatus("PARTIAL_DAY");
      setUnavailableFromPeriod(settings.halfDayBoundaryPeriod);
    } else if (value === "CUSTOM_SHORT_LEAVE") {
      setStatus("SHORT_LEAVE");
      setUnavailableFromPeriod(settings.halfDayBoundaryPeriod);
    } else if (value === "LATE_ARRIVAL") {
      setStatus("LATE");
      setAvailableFromPeriod(3);
    } else if (value === "CUSTOM_PARTIAL_DAY") {
      setStatus("PARTIAL_DAY");
      setAvailableFromPeriod(3);
      setUnavailableFromPeriod(7);
    }
  };

  const buildPayload = (confirmPublishedFixtureImpact: boolean) => ({
    date,
    status,
    reason: reason || null,
    notes: notes || null,
    confirmPublishedFixtureImpact,
    ...(status === "LATE" ? { availableFromPeriod } : {}),
    ...(status === "SHORT_LEAVE" ? { unavailableFromPeriod } : {}),
    ...(status === "PARTIAL_DAY"
      ? {
          availableFromPeriod:
            preset === "SECOND_HALF_LEAVE" ? null : availableFromPeriod,
          unavailableFromPeriod:
            preset === "FIRST_HALF_LEAVE" ? null : unavailableFromPeriod,
        }
      : {}),
  });

  const save = async () => {
    if (!teacherId) return;
    setSaving(true);
    setError("");
    const submit = (confirmed: boolean) =>
      apiRequest<SaveResponse>(`/attendance/${teacherId}`, {
        method: "PUT",
        body: JSON.stringify(buildPayload(confirmed)),
      });
    try {
      let result: SaveResponse;
      try {
        result = await submit(false);
      } catch (saveError) {
        if (
          saveError instanceof ApiClientError &&
          saveError.code === "PUBLISHED_FIXTURE_CONFIRMATION_REQUIRED" &&
          window.confirm(
            "URGENT: This teacher is assigned to a published fixture during an unavailable lesson. The published assignment will not be changed automatically. Confirm the attendance exception and review the published fixture now?",
          )
        ) {
          result = await submit(true);
        } else {
          throw saveError;
        }
      }
      await onSaved(result);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to save attendance exception",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      onClose={onClose}
      title={
        existing ? "Edit Attendance Exception" : "Add Attendance Exception"
      }
    >
      <div className="grid gap-4">
        <label className="text-sm font-semibold text-slate-700">
          Teacher
          <select
            className={`${inputClass} mt-1`}
            disabled={Boolean(existing)}
            onChange={(event) => setTeacherId(event.target.value)}
            value={teacherId}
          >
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.employeeCode})
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Date
          <input className={`${inputClass} mt-1`} disabled value={date} />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Preset
          <select
            className={`${inputClass} mt-1`}
            onChange={(event) => applyPreset(event.target.value as Preset | "")}
            value={preset}
          >
            <option value="">No preset</option>
            <option value="FIRST_HALF_LEAVE">First Half Leave</option>
            <option value="SECOND_HALF_LEAVE">Second Half Leave</option>
            <option value="CUSTOM_SHORT_LEAVE">Leaving After Lesson</option>
            <option value="LATE_ARRIVAL">Late Arrival</option>
            <option value="CUSTOM_PARTIAL_DAY">
              Custom Period Availability
            </option>
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Exception Type
          <select
            className={`${inputClass} mt-1`}
            onChange={(event) => {
              setPreset("");
              setStatus(
                event.target.value as Exclude<AttendanceStatus, "PRESENT">,
              );
            }}
            value={status}
          >
            {exceptionStatuses.map((item) => (
              <option key={item} value={item}>
                {readableEnum(item)}
              </option>
            ))}
          </select>
        </label>
        {status === "LATE" || status === "PARTIAL_DAY" ? (
          <label className="text-sm font-semibold text-slate-700">
            Available from lesson
            <input
              className={`${inputClass} mt-1`}
              max={settings.periodsPerDay}
              min="1"
              onChange={(event) =>
                setAvailableFromPeriod(Number(event.target.value))
              }
              type="number"
              value={availableFromPeriod}
            />
          </label>
        ) : null}
        {status === "SHORT_LEAVE" || status === "PARTIAL_DAY" ? (
          <label className="text-sm font-semibold text-slate-700">
            Unavailable from lesson
            <input
              className={`${inputClass} mt-1`}
              max={settings.periodsPerDay}
              min="1"
              onChange={(event) =>
                setUnavailableFromPeriod(Number(event.target.value))
              }
              type="number"
              value={unavailableFromPeriod}
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              “Unavailable from Lesson {unavailableFromPeriod}” means available
              before that lesson and unavailable from it onward.
            </span>
          </label>
        ) : null}
        <label className="text-sm font-semibold text-slate-700">
          Reason
          <input
            className={`${inputClass} mt-1`}
            maxLength={500}
            onChange={(event) => setReason(event.target.value)}
            value={reason}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Notes
          <textarea
            className={`${inputClass} mt-1`}
            maxLength={2000}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            value={notes}
          />
        </label>
        {error ? <p className="text-sm text-red-700">{error}</p> : null}
        <div className="flex justify-end gap-3">
          <button className={linkButton} onClick={onClose} type="button">
            Cancel
          </button>
          <button
            className={primaryButton}
            disabled={saving || !teacherId}
            onClick={() => void save()}
            type="button"
          >
            {saving ? "Saving…" : "Save Exception"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

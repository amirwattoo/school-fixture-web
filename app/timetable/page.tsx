"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAuth } from "../../components/auth-provider";
import { DashboardShell } from "../../components/dashboard-shell";
import {
  Field,
  FormActions,
  inputClass,
  linkButton,
  PageHeader,
} from "../../components/ui/forms";
import { Modal } from "../../components/ui/modal";
import { PageFeedback } from "../../components/ui/page-feedback";
import { apiRequest } from "../../lib/api";
import {
  type ClassSection,
  DAYS,
  type DayOfWeek,
  readableEnum,
  type Subject,
  type Teacher,
  type TimetableEntry,
} from "../../lib/school-types";

type ViewMode = "day" | "teacher" | "class";

export default function TimetablePage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<ClassSection[]>([]);
  const [view, setView] = useState<ViewMode>("day");
  const [day, setDay] = useState<DayOfWeek>("MONDAY");
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedClass, setSelectedClass] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<TimetableEntry | null | undefined>();

  const loadLookups = useCallback(async () => {
    try {
      const [teacherData, subjectData, classData] = await Promise.all([
        apiRequest<{ teachers: Teacher[] }>("/teachers?isActive=true"),
        apiRequest<{ subjects: Subject[] }>("/subjects?isActive=true"),
        apiRequest<{ classSections: ClassSection[] }>(
          "/class-sections?isActive=true",
        ),
      ]);
      setTeachers(teacherData.teachers);
      setSubjects(subjectData.subjects);
      setClasses(classData.classSections);
      setSelectedTeacher((value) => value || teacherData.teachers[0]?.id || "");
      setSelectedClass(
        (value) => value || classData.classSections[0]?.id || "",
      );
    } catch (lookupError) {
      setError(
        lookupError instanceof Error
          ? lookupError.message
          : "Unable to load timetable choices",
      );
    }
  }, []);

  const loadEntries = useCallback(async () => {
    if (
      (view === "teacher" && !selectedTeacher) ||
      (view === "class" && !selectedClass)
    ) {
      setEntries([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const query = new URLSearchParams();
    if (view === "day") query.set("dayOfWeek", day);
    if (view === "teacher") query.set("teacherId", selectedTeacher);
    if (view === "class") query.set("classSectionId", selectedClass);
    try {
      const data = await apiRequest<{ entries: TimetableEntry[] }>(
        `/timetable?${query.toString()}`,
      );
      setEntries(data.entries);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load timetable",
      );
    } finally {
      setLoading(false);
    }
  }, [day, selectedClass, selectedTeacher, view]);

  useEffect(() => {
    void loadLookups();
  }, [loadLookups]);

  useEffect(() => {
    void loadEntries();
  }, [loadEntries]);

  const deleteEntry = async (entry: TimetableEntry) => {
    if (
      !window.confirm(
        `Delete ${entry.subject.name} for ${entry.classSection.name}?`,
      )
    )
      return;
    try {
      await apiRequest(`/timetable/${entry.id}`, { method: "DELETE" });
      await loadEntries();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Unable to delete lecture",
      );
    }
  };

  return (
    <DashboardShell>
      <PageHeader
        addLabel="Add lecture"
        description="Manage the master timetable with teacher and class conflict checks."
        onAdd={() => setEditing(null)}
        title="Timetable"
      />
      <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex flex-wrap gap-2">
          {(["day", "teacher", "class"] as const).map((mode) => (
            <button
              className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                view === mode
                  ? "bg-primary text-white"
                  : "bg-slate-100 text-slate-700"
              }`}
              key={mode}
              onClick={() => setView(mode)}
              type="button"
            >
              {readableEnum(mode)} view
            </button>
          ))}
        </div>
        {view === "day" ? (
          <select
            className={inputClass}
            onChange={(event) => setDay(event.target.value as DayOfWeek)}
            value={day}
          >
            {DAYS.map((item) => (
              <option key={item} value={item}>
                {readableEnum(item)}
              </option>
            ))}
          </select>
        ) : null}
        {view === "teacher" ? (
          <select
            className={inputClass}
            onChange={(event) => setSelectedTeacher(event.target.value)}
            value={selectedTeacher}
          >
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.employeeCode})
              </option>
            ))}
          </select>
        ) : null}
        {view === "class" ? (
          <select
            className={inputClass}
            onChange={(event) => setSelectedClass(event.target.value)}
            value={selectedClass}
          >
            {classes.map((classSection) => (
              <option key={classSection.id} value={classSection.id}>
                {classSection.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <PageFeedback
        empty={!entries.length}
        error={error}
        loading={loading}
        onRetry={async () => {
          await loadLookups();
          await loadEntries();
        }}
      />
      {!loading && !error && entries.length ? (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                {[
                  "Day",
                  "Period",
                  "Class",
                  "Teacher",
                  "Subject",
                  "Actions",
                ].map((heading) => (
                  <th className="px-4 py-3" key={heading}>
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">{readableEnum(entry.dayOfWeek)}</td>
                  <td className="px-4 py-3 font-semibold">
                    {entry.periodNumber}
                  </td>
                  <td className="px-4 py-3">{entry.classSection.name}</td>
                  <td className="px-4 py-3">
                    {entry.teacher.name} ({entry.teacher.employeeCode})
                  </td>
                  <td className="px-4 py-3">
                    {entry.subject.name} ({entry.subject.code})
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      className={linkButton}
                      onClick={() => setEditing(entry)}
                      type="button"
                    >
                      Edit
                    </button>
                    <button
                      className={`${linkButton} ml-3 text-red-700`}
                      onClick={() => void deleteEntry(entry)}
                      type="button"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {editing !== undefined ? (
        <LectureModal
          classes={classes}
          entry={editing}
          onClose={() => setEditing(undefined)}
          onSaved={async () => {
            setEditing(undefined);
            await loadEntries();
          }}
          periodsPerDay={user?.school.periodsPerDay ?? 8}
          subjects={subjects}
          teachers={teachers}
        />
      ) : null}
    </DashboardShell>
  );
}

function LectureModal({
  entry,
  teachers,
  subjects,
  classes,
  periodsPerDay,
  onClose,
  onSaved,
}: {
  entry: TimetableEntry | null;
  teachers: Teacher[];
  subjects: Subject[];
  classes: ClassSection[];
  periodsPerDay: number;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const schema = z.object({
    dayOfWeek: z.enum(DAYS),
    periodNumber: z
      .number()
      .int()
      .min(1)
      .max(periodsPerDay, `Maximum period is ${periodsPerDay}`),
    classSectionId: z.string().min(1, "Select a class"),
    teacherId: z.string().min(1, "Select a teacher"),
    subjectId: z.string().min(1, "Select a subject"),
  });
  type LectureForm = z.infer<typeof schema>;
  const [serverError, setServerError] = useState("");
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LectureForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      dayOfWeek: entry?.dayOfWeek ?? "MONDAY",
      periodNumber: entry?.periodNumber ?? 1,
      classSectionId: entry?.classSectionId ?? classes[0]?.id ?? "",
      teacherId: entry?.teacherId ?? teachers[0]?.id ?? "",
      subjectId: entry?.subjectId ?? subjects[0]?.id ?? "",
    },
  });

  const submit = async (values: LectureForm) => {
    setServerError("");
    try {
      await apiRequest(entry ? `/timetable/${entry.id}` : "/timetable", {
        method: entry ? "PATCH" : "POST",
        body: JSON.stringify(values),
      });
      await onSaved();
    } catch (submitError) {
      setServerError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to save lecture",
      );
    }
  };

  return (
    <Modal onClose={onClose} title={entry ? "Edit lecture" : "Add lecture"}>
      <form
        className="grid gap-4 sm:grid-cols-2"
        onSubmit={handleSubmit(submit)}
      >
        <Field error={errors.dayOfWeek?.message} label="Day">
          <select className={inputClass} {...register("dayOfWeek")}>
            {DAYS.map((item) => (
              <option key={item} value={item}>
                {readableEnum(item)}
              </option>
            ))}
          </select>
        </Field>
        <Field error={errors.periodNumber?.message} label="Period">
          <input
            className={inputClass}
            max={periodsPerDay}
            min="1"
            type="number"
            {...register("periodNumber", { valueAsNumber: true })}
          />
        </Field>
        <Field error={errors.classSectionId?.message} label="Class">
          <select className={inputClass} {...register("classSectionId")}>
            {classes.map((classSection) => (
              <option key={classSection.id} value={classSection.id}>
                {classSection.name}
              </option>
            ))}
          </select>
        </Field>
        <Field error={errors.teacherId?.message} label="Teacher">
          <select className={inputClass} {...register("teacherId")}>
            {teachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.name} ({teacher.employeeCode})
              </option>
            ))}
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field error={errors.subjectId?.message} label="Subject">
            <select className={inputClass} {...register("subjectId")}>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name} ({subject.code})
                </option>
              ))}
            </select>
          </Field>
        </div>
        {serverError ? (
          <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            {serverError}
          </p>
        ) : null}
        <FormActions
          isSubmitting={isSubmitting}
          onCancel={onClose}
          submitLabel={entry ? "Save changes" : "Add lecture"}
        />
      </form>
    </Modal>
  );
}

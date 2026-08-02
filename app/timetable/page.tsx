"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { DashboardShell } from "../../components/dashboard-shell";
import { TimetableTabs } from "../../components/timetable-tabs";
import { Field, FormActions, inputClass, primaryButton, secondaryButton } from "../../components/ui/forms";
import { Modal } from "../../components/ui/modal";
import { apiRequest, cachedApiRequest, invalidateApiCache } from "../../lib/api";
import { DAYS, type DayOfWeek, readableEnum } from "../../lib/school-types";
import { buildClassRows, buildTeacherRows, mobileAssignments, type GridAssignment, type GridEntry, type TimetableGridData } from "../../lib/timetable-grid";

const workingDays = DAYS.slice(0, 5);
const periods = (count: number) => Array.from({ length: count }, (_, index) => index + 1);
const shortDays = (days: DayOfWeek[]) => days.map((day) => readableEnum(day).slice(0, 3)).join(" · ");

export default function TimetablePage() {
  return <Suspense fallback={<DashboardShell><p className="text-sm text-slate-500">Loading timetable…</p></DashboardShell>}><TimetableScreen/></Suspense>;
}

function TimetableScreen() {
  const searchParams = useSearchParams();
  const view = searchParams.get("view") === "teacher" ? "teacher" : "class";
  const [data, setData] = useState<TimetableGridData>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<GridEntry | null | undefined>();
  const [density, setDensity] = useState<"compact" | "comfortable">("compact");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [teacherSearch, setTeacherSearch] = useState("");
  const [teacherDay, setTeacherDay] = useState<DayOfWeek | "">("");
  const [mobileEntityId, setMobileEntityId] = useState("");
  const [mobileDay, setMobileDay] = useState<DayOfWeek>("MONDAY");

  const load = useCallback(async (fresh = false) => {
    setLoading(true); setError("");
    try {
      const path = `/timetable/grid?view=${view}`;
      const response = fresh ? await apiRequest<{ grid: TimetableGridData }>(path) : await cachedApiRequest<{ grid: TimetableGridData }>(path);
      setData(response.grid);
      setMobileEntityId((current) => current || (view === "class" ? response.grid.classes[0]?.id : response.grid.teachers[0]?.id) || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load timetable"); }
    finally { setLoading(false); }
  }, [view]);

  useEffect(() => { setData(undefined); setMobileEntityId(""); void load(); }, [load]);

  const classRows = useMemo(() => data ? buildClassRows(data, { classId, subjectId, teacherId }) : [], [classId, data, subjectId, teacherId]);
  const teacherRows = useMemo(() => data ? buildTeacherRows(data, { search: teacherSearch, day: teacherDay || undefined }) : [], [data, teacherDay, teacherSearch]);
  const mobile = useMemo(() => data && mobileEntityId ? mobileAssignments(data, view, mobileEntityId, mobileDay) : [], [data, mobileDay, mobileEntityId, view]);
  const saved = async () => { invalidateApiCache("/timetable/grid"); setEditing(undefined); await load(true); };

  return <DashboardShell><div className="timetable-print-area"><TimetableTabs active={view}/><div className="timetable-actions mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-bold text-ink">{view === "class" ? "Class Timetable" : "Teacher Timetable"}</h2><p className="mt-1 text-sm text-slate-600">{view === "class" ? "All classes and parallel subject groups in one printable view." : "Teacher workloads, free lessons, and scheduling conflicts."}</p></div><div className="flex gap-2"><button className={secondaryButton} onClick={() => window.print()} type="button">Print landscape</button><button className={primaryButton} onClick={() => setEditing(null)} type="button">Add assignment</button></div></div>
    {error ? <div className="mb-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error} <button className="font-semibold underline" onClick={() => void load(true)}>Retry</button></div> : null}
    {loading && !data ? <p className="rounded-xl border bg-white p-5 text-sm text-slate-500">Loading timetable…</p> : null}
    {data ? <>
      <div className="timetable-actions mb-4 hidden flex-wrap gap-3 rounded-2xl border bg-white p-4 md:flex">{view === "class" ? <><Filter label="Class" value={classId} onChange={setClassId} options={data.classes.map((item) => [item.id, item.name])}/><Filter label="Subject" value={subjectId} onChange={setSubjectId} options={data.subjects.map((item) => [item.id, `${item.name} (${item.code})`])}/><Filter label="Teacher" value={teacherId} onChange={setTeacherId} options={data.teachers.map((item) => [item.id, item.name])}/></> : <><label className="min-w-64 flex-1 text-xs font-semibold uppercase text-slate-500">Teacher search<input className={`${inputClass} mt-1 normal-case`} onChange={(event) => setTeacherSearch(event.target.value)} placeholder="Name or employee code" value={teacherSearch}/></label><Filter label="Day" value={teacherDay} onChange={(value) => setTeacherDay(value as DayOfWeek | "")} options={workingDays.map((day) => [day, readableEnum(day)])}/></>}<label className="text-xs font-semibold uppercase text-slate-500">Density<select className={`${inputClass} mt-1 normal-case`} onChange={(event) => setDensity(event.target.value as typeof density)} value={density}><option value="compact">Compact</option><option value="comfortable">Comfortable</option></select></label></div>
      <div className="timetable-desktop hidden md:block"><TimetableTable assignments={view === "class" ? classRows : teacherRows} density={density} mode={view} onEdit={(assignment) => setEditing(assignment.entries[0])} periodsPerDay={data.periodsPerDay} visibleDays={teacherDay ? [teacherDay] : workingDays}/></div>
      <div className="timetable-mobile md:hidden"><div className="timetable-actions mb-4 grid gap-3 rounded-2xl border bg-white p-4"><Filter label={view === "class" ? "Class" : "Teacher"} value={mobileEntityId} onChange={setMobileEntityId} includeAll={false} options={(view === "class" ? data.classes : data.teachers).map((item) => [item.id, item.name])}/><Filter label="Day" value={mobileDay} onChange={(value) => setMobileDay(value as DayOfWeek)} includeAll={false} options={workingDays.map((day) => [day, readableEnum(day)])}/></div><div className="space-y-3">{mobile.map((lesson) => <article className="rounded-2xl border bg-white p-4" key={lesson.periodNumber}><h3 className="text-xs font-bold uppercase tracking-wide text-primary">Lesson {lesson.periodNumber}</h3>{lesson.assignments.length ? <div className="mt-3 space-y-2">{lesson.assignments.map((item) => <button className="block w-full rounded-xl bg-slate-50 p-3 text-left" key={item.entry.id} onClick={() => setEditing(item.entry)} type="button"><span className="block font-bold">{item.subject.code} · {view === "class" ? item.teacher.name : item.classSection.name}</span><span className="mt-1 block text-xs text-slate-600">{item.subject.name} · {item.classSection.name} · {item.teacher.name} · {readableEnum(item.entry.dayOfWeek)}</span></button>)}</div> : <p className="mt-2 text-sm font-medium text-emerald-700">Free period</p>}</article>)}</div></div>
    </> : null}</div>{editing !== undefined && data ? <AssignmentModal data={data} entry={editing} onClose={() => setEditing(undefined)} onSaved={saved}/> : null}</DashboardShell>;
}

function Filter({ label, value, onChange, options, includeAll = true }: { label: string; value: string; onChange: (value: string) => void; options: Array<[string, string]>; includeAll?: boolean }) {
  return <label className="min-w-44 flex-1 text-xs font-semibold uppercase text-slate-500">{label}<select className={`${inputClass} mt-1 normal-case`} onChange={(event) => onChange(event.target.value)} value={value}>{includeAll ? <option value="">All {label.toLocaleLowerCase("en")}s</option> : null}{options.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>;
}

function TimetableTable({ assignments, periodsPerDay, mode, density, onEdit, visibleDays }: { assignments: Array<{ entity: { id: string; name: string; baseWeeklyTeachingPeriods?: number }; cells: Map<number, GridAssignment[]> }>; periodsPerDay: number; mode: "class" | "teacher"; density: "compact" | "comfortable"; onEdit: (assignment: GridAssignment) => void; visibleDays: DayOfWeek[] }) {
  const padding = density === "compact" ? "p-1.5" : "p-3";
  return <div className={`timetable-grid timetable-density-${density} max-h-[72vh] overflow-auto rounded-xl border bg-white`}><table className="w-full min-w-[1180px] table-fixed border-collapse text-[11px]"><thead><tr><th className={`sticky left-0 top-0 z-30 w-36 border bg-slate-100 ${padding} text-left`}>{mode === "class" ? "Class" : "Teacher"}</th>{periods(periodsPerDay).map((period) => <th className={`sticky top-0 z-20 border bg-slate-100 ${padding}`} key={period}>Lesson {period}</th>)}{mode === "teacher" ? <th className={`sticky top-0 z-20 w-20 border bg-slate-100 ${padding}`}>Workload</th> : null}</tr></thead><tbody>{assignments.map((row) => <tr className="break-inside-avoid" key={row.entity.id}><th className={`sticky left-0 z-10 border bg-white ${padding} text-left align-top font-bold`}>{row.entity.name}</th>{periods(periodsPerDay).map((period) => { const cell = row.cells.get(period) ?? []; const occupiedDays = new Set(cell.flatMap((assignment) => assignment.days)); const freeDays = visibleDays.filter((day) => !occupiedDays.has(day)); return <td className={`border ${padding} align-top`} key={period}>{cell.length ? <div className="space-y-1">{cell.map((assignment) => <button className={`block w-full rounded border p-1 text-left leading-tight hover:border-primary ${assignment.teacherConflict ? "border-red-400 bg-red-50 text-red-900" : "border-slate-200 bg-slate-50"}`} key={`${assignment.subject.id}:${assignment.teacher.id}`} onClick={() => onEdit(assignment)} type="button"><span className="block font-bold">{assignment.subject.code} · {mode === "class" ? assignment.teacher.name : assignment.classSection.name}</span><span className="block text-[9px] text-slate-500">{shortDays(assignment.days)}</span>{assignment.teacherConflict ? <span className="mt-1 block text-[9px] font-bold uppercase">Double-booked</span> : null}</button>)}{mode === "teacher" && freeDays.length ? <span className="block text-[9px] font-semibold text-emerald-600">Free: {shortDays(freeDays)}</span> : null}</div> : mode === "teacher" ? <span className="font-semibold text-emerald-600">Free</span> : <span className="text-slate-300">—</span>}</td>; })}{mode === "teacher" ? <td className={`border ${padding} text-center font-bold`}>{row.entity.baseWeeklyTeachingPeriods}</td> : null}</tr>)}</tbody></table></div>;
}

function AssignmentModal({ data, entry, onClose, onSaved }: { data: TimetableGridData; entry: GridEntry | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const schema = z.object({ dayOfWeek: z.enum(DAYS), periodNumber: z.number().int().min(1).max(data.periodsPerDay), classSectionId: z.string().min(1), teacherId: z.string().min(1), subjectId: z.string().min(1) });
  type FormValue = z.infer<typeof schema>;
  const [serverError, setServerError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValue>({ resolver: zodResolver(schema), defaultValues: { dayOfWeek: entry?.dayOfWeek ?? "MONDAY", periodNumber: entry?.periodNumber ?? 1, classSectionId: entry?.classSectionId ?? data.classes[0]?.id ?? "", teacherId: entry?.teacherId ?? data.teachers[0]?.id ?? "", subjectId: entry?.subjectId ?? data.subjects[0]?.id ?? "" } });
  const submit = async (values: FormValue) => { if (!window.confirm(entry ? "Confirm this timetable assignment change? Teacher availability and conflicts will be revalidated." : "Confirm this new timetable assignment?")) return; setServerError(""); try { await apiRequest(entry ? `/timetable/${entry.id}` : "/timetable", { method: entry ? "PATCH" : "POST", body: JSON.stringify(entry ? { ...values, confirmChange: true } : values) }); await onSaved(); } catch (reason) { setServerError(reason instanceof Error ? reason.message : "Unable to save assignment"); } };
  const remove = async () => { if (!entry || !window.confirm("Delete this assignment? Referenced historical fixture assignments cannot be deleted.")) return; setServerError(""); try { await apiRequest(`/timetable/${entry.id}`, { method: "DELETE" }); await onSaved(); } catch (reason) { setServerError(reason instanceof Error ? reason.message : "Unable to delete assignment"); } };
  return <Modal onClose={onClose} title={entry ? `Edit ${readableEnum(entry.dayOfWeek)} assignment` : "Add timetable assignment"}><form className="grid gap-4 sm:grid-cols-2" onSubmit={handleSubmit(submit)}><Field error={errors.dayOfWeek?.message} label="Day"><select className={inputClass} {...register("dayOfWeek")}>{workingDays.map((day) => <option key={day} value={day}>{readableEnum(day)}</option>)}</select></Field><Field error={errors.periodNumber?.message} label="Lesson"><input className={inputClass} min="1" max={data.periodsPerDay} type="number" {...register("periodNumber", { valueAsNumber: true })}/></Field><Field error={errors.classSectionId?.message} label="Class"><select className={inputClass} {...register("classSectionId")}>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field error={errors.teacherId?.message} label="Teacher"><select className={inputClass} {...register("teacherId")}>{data.teachers.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.employeeCode})</option>)}</select></Field><div className="sm:col-span-2"><Field error={errors.subjectId?.message} label="Subject"><select className={inputClass} {...register("subjectId")}>{data.subjects.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}</select></Field></div>{entry ? <p className="sm:col-span-2 text-xs text-slate-500">Only the selected day-specific record is edited. Other days shown in the grouped grid remain unchanged.</p> : null}{serverError ? <p className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{serverError}</p> : null}<div className="sm:col-span-2 flex items-center justify-between">{entry ? <button className="text-sm font-semibold text-red-700" onClick={() => void remove()} type="button">Delete assignment</button> : <span/>}<FormActions isSubmitting={isSubmitting} onCancel={onClose} submitLabel={entry ? "Save changes" : "Add assignment"}/></div></form></Modal>;
}

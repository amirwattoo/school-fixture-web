import type { DayOfWeek } from "./school-types";

export type GridEntry = {
  id: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  classSectionId: string;
  teacherId: string;
  subjectId: string;
};

export type GridClass = { id: string; name: string; gradeNumber: number | null; section: string };
export type GridTeacher = { id: string; name: string; employeeCode: string; baseWeeklyTeachingPeriods: number };
export type GridSubject = { id: string; name: string; code: string };
export type TimetableGridData = {
  view: "class" | "teacher";
  periodsPerDay: number;
  days: DayOfWeek[];
  entries: GridEntry[];
  classes: GridClass[];
  teachers: GridTeacher[];
  subjects: GridSubject[];
};

export type GridAssignment = {
  entries: GridEntry[];
  days: DayOfWeek[];
  classSection: GridClass;
  teacher: GridTeacher;
  subject: GridSubject;
  teacherConflict: boolean;
};

export type GridRow<T> = { entity: T; cells: Map<number, GridAssignment[]> };

const dayOrder = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as DayOfWeek[];
const orderedDays = (days: Iterable<DayOfWeek>) => [...new Set(days)].sort((left, right) => dayOrder.indexOf(left) - dayOrder.indexOf(right));

const hydrate = (data: TimetableGridData, entries: GridEntry[]) => {
  const classes = new Map(data.classes.map((item) => [item.id, item]));
  const teachers = new Map(data.teachers.map((item) => [item.id, item]));
  const subjects = new Map(data.subjects.map((item) => [item.id, item]));
  return entries.flatMap((entry) => {
    const classSection = classes.get(entry.classSectionId);
    const teacher = teachers.get(entry.teacherId);
    const subject = subjects.get(entry.subjectId);
    return classSection && teacher && subject ? [{ entry, classSection, teacher, subject }] : [];
  });
};

const teacherConflictKeys = (entries: GridEntry[]) => {
  const slots = new Map<string, Set<string>>();
  for (const entry of entries) {
    const key = `${entry.teacherId}:${entry.dayOfWeek}:${entry.periodNumber}`;
    const classes = slots.get(key) ?? new Set<string>();
    classes.add(entry.classSectionId);
    slots.set(key, classes);
  }
  return new Set([...slots].filter(([, classes]) => classes.size > 1).map(([key]) => key));
};

const groupedRows = <T extends { id: string }>(
  data: TimetableGridData,
  entities: T[],
  rowKey: (entry: GridEntry) => string,
  assignmentKey: (entry: GridEntry) => string,
  entries: GridEntry[],
): GridRow<T>[] => {
  const conflicts = teacherConflictKeys(entries);
  const rows = new Map(entities.map((entity) => [entity.id, { entity, cells: new Map<number, Map<string, GridAssignment>>() }]));
  for (const item of hydrate(data, entries)) {
    const row = rows.get(rowKey(item.entry));
    if (!row) continue;
    const period = row.cells.get(item.entry.periodNumber) ?? new Map<string, GridAssignment>();
    const key = assignmentKey(item.entry);
    const assignment = period.get(key) ?? { entries: [], days: [], classSection: item.classSection, teacher: item.teacher, subject: item.subject, teacherConflict: false };
    assignment.entries.push(item.entry);
    assignment.days = orderedDays([...assignment.days, item.entry.dayOfWeek]);
    assignment.teacherConflict ||= conflicts.has(`${item.entry.teacherId}:${item.entry.dayOfWeek}:${item.entry.periodNumber}`);
    period.set(key, assignment);
    row.cells.set(item.entry.periodNumber, period);
  }
  return [...rows.values()].map((row) => ({ entity: row.entity, cells: new Map([...row.cells].map(([period, assignments]) => [period, [...assignments.values()]])) }));
};

export const buildClassRows = (
  data: TimetableGridData,
  filters: { classId?: string; subjectId?: string; teacherId?: string } = {},
) => {
  const entries = data.entries.filter((entry) => (!filters.classId || entry.classSectionId === filters.classId) && (!filters.subjectId || entry.subjectId === filters.subjectId) && (!filters.teacherId || entry.teacherId === filters.teacherId));
  const classes = data.classes.filter((item) => !filters.classId || item.id === filters.classId);
  return groupedRows(data, classes, (entry) => entry.classSectionId, (entry) => `${entry.subjectId}:${entry.teacherId}`, entries);
};

export const buildTeacherRows = (
  data: TimetableGridData,
  filters: { search?: string; day?: DayOfWeek } = {},
) => {
  const search = filters.search?.trim().toLocaleLowerCase("en") ?? "";
  const teachers = data.teachers.filter((teacher) => !search || `${teacher.name} ${teacher.employeeCode}`.toLocaleLowerCase("en").includes(search));
  const teacherIds = new Set(teachers.map((teacher) => teacher.id));
  const entries = data.entries.filter((entry) => teacherIds.has(entry.teacherId) && (!filters.day || entry.dayOfWeek === filters.day));
  return groupedRows(data, teachers, (entry) => entry.teacherId, (entry) => `${entry.classSectionId}:${entry.subjectId}`, entries);
};

export const mobileAssignments = (data: TimetableGridData, mode: "class" | "teacher", entityId: string, day: DayOfWeek) => {
  const entries = data.entries.filter((entry) => entry.dayOfWeek === day && (mode === "class" ? entry.classSectionId === entityId : entry.teacherId === entityId));
  return Array.from({ length: data.periodsPerDay }, (_, index) => ({ periodNumber: index + 1, assignments: hydrate(data, entries.filter((entry) => entry.periodNumber === index + 1)) }));
};

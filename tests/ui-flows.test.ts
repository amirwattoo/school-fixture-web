import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { buildTeacherMappingPayload, canConfirmTimetableImport, initializeTeacherMappings, resolveTimetableImportValidation, teacherMappingDiagnostic } from "../lib/timetable-import";
import { buildClassRows, buildTeacherRows, mobileAssignments, type TimetableGridData } from "../lib/timetable-grid";

const source = (path: string) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Proxy Management branding is present in metadata, login, and authenticated navigation", async () => {
  const contents = await Promise.all([source("app/layout.tsx"), source("app/login/page.tsx"), source("components/dashboard-shell.tsx"), source("app/manifest.ts")]);
  contents.forEach((content) => assert.match(content, /Proxy Management/));
});

test("mobile account experience exposes authenticated name, role, email, school, and logout", async () => {
  const content = await source("components/dashboard-shell.tsx");
  for (const expression of [/user\.name/, /user\.email/, /user\.role/, /user\.school\.name/, /Logout/]) assert.match(content, expression);
  assert.match(content, /md:hidden/);
});

test("forgot and reset password screens call the public recovery endpoints", async () => {
  assert.match(await source("app/forgot-password/page.tsx"), /\/auth\/forgot-password/);
  const reset = await source("app/reset-password/page.tsx");
  assert.match(reset, /\/auth\/reset-password/); assert.match(reset, /newPassword/);
});

test("timetable import UI includes upload, preview, mapping, confirmation, retry, and history states", async () => {
  const content = await source("app/timetable/import/page.tsx");
  for (const expression of [/uploadApiRequest/, /teacherMappings/, /confirmReplace/, /Retry preview/, /TimetableTabs/, /Processing and validating/, /timetable\?view=class/]) assert.match(content, expression);
  assert.match(await source("app/timetable/history/page.tsx"), /Import History/);
});

test("timetable confirmation remains enabled when only parallel-assignment warnings exist", () => {
  assert.equal(canConfirmTimetableImport({ blockingErrors: [], duplicateRows: [], invalidRows: [], teacherMatches: [{ sourceTeacherRef: "src-1", sourceName: "Teacher One", status: "matched" }, { sourceTeacherRef: "src-2", sourceName: "Teacher Two", status: "new" }] }, {}), true);
});

test("timetable confirmation requires mappings and valid assignments", () => {
  const preview = { blockingErrors: [], duplicateRows: [], invalidRows: [], teacherMatches: [{ sourceTeacherRef: "src-ahmed", sourceName: "M. Ahmed", status: "ambiguous" as const }] };
  assert.equal(canConfirmTimetableImport(preview, {}), false);
  assert.equal(canConfirmTimetableImport(preview, { "src-ahmed": "teacher-id" }), true);
  assert.equal(canConfirmTimetableImport({ ...preview, duplicateRows: [3] }, { "src-ahmed": "teacher-id" }), false);
  assert.equal(canConfirmTimetableImport({ ...preview, invalidRows: [{ rowNumber: 4 }] }, { "src-ahmed": "teacher-id" }), false);
});

test("timetable confirmation revalidates resolved teacher identities", () => {
  const rows = [
    { dayOfWeek: "MONDAY", periodNumber: 4, className: "9A", teacherName: "Ehsan Ul Haq", sourceTeacherRef: "src-upper", subjectCode: "BIO", rowNumber: 2 },
    { dayOfWeek: "MONDAY", periodNumber: 4, className: "9B", teacherName: "Ehsan ul Haq", sourceTeacherRef: "src-lower", subjectCode: "CHEM", rowNumber: 3 },
  ];
  const preview = { rows, blockingErrors: [], duplicateRows: [], invalidRows: [], teacherMatches: [
    { sourceTeacherRef: "src-upper", sourceName: "Ehsan Ul Haq", status: "matched" as const, teacherId: "teacher-one" },
    { sourceTeacherRef: "src-lower", sourceName: "Ehsan ul Haq", status: "matched" as const, teacherId: "teacher-two" },
  ] };
  assert.deepEqual(resolveTimetableImportValidation(preview, {}).blockingErrors, []);
  assert.equal(canConfirmTimetableImport(preview, {}), true);
  assert.equal(resolveTimetableImportValidation({ ...preview, teacherMatches: preview.teacherMatches.map((match) => ({ ...match, teacherId: "teacher-one" })) }, {}).blockingErrors.length, 2);
});

test("confirm becomes enabled only after an ambiguous mapping resolves without a real conflict", () => {
  const preview = {
    rows: [
      { dayOfWeek: "MONDAY", periodNumber: 4, className: "9A", teacherName: "Known", sourceTeacherRef: "src-known", subjectCode: "BIO", rowNumber: 2 },
      { dayOfWeek: "MONDAY", periodNumber: 4, className: "9B", teacherName: "Alias", sourceTeacherRef: "src-alias", subjectCode: "CHEM", rowNumber: 3 },
    ],
    blockingErrors: ["Teacher mapping required for Alias."], duplicateRows: [], invalidRows: [],
    teacherMatches: [
      { sourceTeacherRef: "src-known", sourceName: "Known", status: "matched" as const, teacherId: "teacher-one" },
      { sourceTeacherRef: "src-alias", sourceName: "Alias", status: "ambiguous" as const },
    ],
  };
  assert.equal(canConfirmTimetableImport(preview, {}), false);
  assert.equal(canConfirmTimetableImport(preview, { "src-alias": "teacher-one" }), false);
  assert.equal(canConfirmTimetableImport(preview, { "src-alias": "teacher-two" }), true);
});

test("case-different teacher mappings survive state and payload serialization by source reference", () => {
  const preview = { blockingErrors: [], duplicateRows: [], invalidRows: [], teacherMatches: [
    { sourceTeacherRef: "src-upper", sourceName: "Ehsan Ul Haq", status: "matched" as const, teacherId: "teacher-one" },
    { sourceTeacherRef: "src-lower", sourceName: "Ehsan ul Haq", status: "matched" as const, teacherId: "teacher-two" },
  ] };
  const mappings = initializeTeacherMappings(preview);
  assert.deepEqual(mappings, { "src-upper": "teacher-one", "src-lower": "teacher-two" });
  const restored = initializeTeacherMappings(preview, JSON.parse(JSON.stringify(mappings)) as Record<string, string>);
  assert.deepEqual(restored, mappings);
  assert.deepEqual(buildTeacherMappingPayload(preview, restored), [
    { sourceTeacherRef: "src-upper", sourceTeacherName: "Ehsan Ul Haq", resolvedTeacherId: "teacher-one" },
    { sourceTeacherRef: "src-lower", sourceTeacherName: "Ehsan ul Haq", resolvedTeacherId: "teacher-two" },
  ]);
  assert.deepEqual(teacherMappingDiagnostic(preview, restored), { detectedTeachers: 2, mappingEntries: 2, uniqueResolvedTeacherIds: 2 });
  assert.equal(canConfirmTimetableImport(preview, restored), true);
});

const grid: TimetableGridData = {
  view: "class",
  periodsPerDay: 3,
  days: ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  classes: [{ id: "9a", name: "9A", gradeNumber: 9, section: "A" }, { id: "9b", name: "9B", gradeNumber: 9, section: "B" }],
  teachers: [{ id: "t1", name: "Teacher One", employeeCode: "T1", baseWeeklyTeachingPeriods: 12 }, { id: "t2", name: "Teacher Two", employeeCode: "T2", baseWeeklyTeachingPeriods: 14 }],
  subjects: [{ id: "comp", name: "Computer Science", code: "COMP" }, { id: "bio", name: "Biology", code: "BIO" }],
  entries: [
    { id: "e1", dayOfWeek: "MONDAY", periodNumber: 1, classSectionId: "9a", teacherId: "t1", subjectId: "comp" },
    { id: "e2", dayOfWeek: "TUESDAY", periodNumber: 1, classSectionId: "9a", teacherId: "t1", subjectId: "comp" },
    { id: "e3", dayOfWeek: "MONDAY", periodNumber: 1, classSectionId: "9a", teacherId: "t2", subjectId: "bio" },
    { id: "e4", dayOfWeek: "MONDAY", periodNumber: 1, classSectionId: "9b", teacherId: "t1", subjectId: "bio" },
  ],
};

test("class grid groups days and stacks parallel assignments", () => {
  const rows = buildClassRows(grid);
  const classNineA = rows.find((row) => row.entity.id === "9a")!;
  assert.equal(classNineA.cells.get(1)?.length, 2);
  assert.deepEqual(classNineA.cells.get(1)?.find((item) => item.subject.code === "COMP")?.days, ["MONDAY", "TUESDAY"]);
});

test("teacher grid groups assignments, exposes free periods, filters days, and flags double-booking", () => {
  const rows = buildTeacherRows(grid);
  const teacherOne = rows.find((row) => row.entity.id === "t1")!;
  assert.equal(teacherOne.cells.get(1)?.length, 2);
  assert.equal(teacherOne.cells.get(2), undefined);
  assert.ok(teacherOne.cells.get(1)?.every((item) => item.teacherConflict));
  const tuesday = buildTeacherRows(grid, { day: "TUESDAY" }).find((row) => row.entity.id === "t1")!;
  assert.equal(tuesday.cells.get(1)?.length, 1);
  assert.equal(tuesday.cells.get(1)?.[0]?.teacherConflict, false);
});

test("mobile timetable returns one filtered day without rendering a wide grid", () => {
  const lessons = mobileAssignments(grid, "class", "9a", "MONDAY");
  assert.equal(lessons.length, 3);
  assert.equal(lessons[0]?.assignments.length, 2);
  assert.equal(lessons[1]?.assignments.length, 0);
  assert.ok(lessons[0]?.assignments.every((item) => item.entry.dayOfWeek === "MONDAY"));
});

test("timetable page uses one grid request and includes responsive and print layout structure", async () => {
  const [page, css] = await Promise.all([source("app/timetable/page.tsx"), source("app/globals.css")]);
  assert.equal(page.match(/\/timetable\/grid\?view=/g)?.length, 1);
  assert.doesNotMatch(page, /\/teachers\?isActive|\/subjects\?isActive|\/class-sections\?isActive/);
  for (const marker of [/timetable-desktop/, /timetable-mobile/, /sticky left-0 top-0/, /Free period/]) assert.match(page, marker);
  for (const marker of [/@page/, /size: landscape/, /table-header-group/, /break-inside: avoid/, /timetable-actions/]) assert.match(css, marker);
});

export type TimetableTeacherMatch = {
  sourceName: string;
  status: "matched" | "new" | "ambiguous";
  teacherId?: string;
  temporaryIdentity?: string;
  resolvedTeacherIdentifier?: string;
  candidates?: Array<{
    id: string;
    name: string;
    resolvedTeacherIdentifier: string;
  }>;
};

export type TimetableImportValidation = {
  blockingErrors: string[];
  duplicateRows: number[];
  invalidRows: Array<{ rowNumber: number }>;
  teacherMatches: TimetableTeacherMatch[];
  rows?: Array<{
    dayOfWeek: string;
    periodNumber: number;
    className: string;
    teacherName: string;
    subjectCode: string;
    rowNumber: number;
  }>;
};

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase("en").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const resolveTimetableImportValidation = (
  preview: TimetableImportValidation,
  mappings: Record<string, string>,
) => {
  if (!preview.rows) return { blockingErrors: preview.blockingErrors, duplicateRows: preview.duplicateRows };
  const identities = new Map<string, string>();
  const blockingErrors: string[] = [];
  for (const match of preview.teacherMatches) {
    const mappedId = mappings[match.sourceName];
    if (match.status === "ambiguous" && !mappedId) {
      blockingErrors.push(`Teacher mapping required for ${match.sourceName}.`);
      continue;
    }
    identities.set(match.sourceName, mappedId || match.teacherId || match.temporaryIdentity || `preview:${match.sourceName}`);
  }

  const seen = new Map<string, number>();
  const duplicateRows: number[] = [];
  for (const row of preview.rows) {
    const identity = identities.get(row.teacherName);
    if (!identity) continue;
    const key = `${row.dayOfWeek}|${row.periodNumber}|${normalize(row.className)}|${identity}|${normalize(row.subjectCode)}`;
    const originalRow = seen.get(key);
    if (originalRow !== undefined) {
      duplicateRows.push(row.rowNumber);
      blockingErrors.push(`CSV source row ${row.rowNumber} | Teacher: ${row.teacherName} | Exact duplicate assignment of CSV source row ${originalRow}.`);
    } else seen.set(key, row.rowNumber);
  }

  const duplicateSet = new Set(duplicateRows);
  const slots = new Map<string, typeof preview.rows>();
  for (const row of preview.rows.filter((item) => !duplicateSet.has(item.rowNumber))) {
    const identity = identities.get(row.teacherName);
    if (!identity) continue;
    const key = `${row.dayOfWeek}|${row.periodNumber}|${identity}`;
    slots.set(key, [...(slots.get(key) ?? []), row]);
  }
  for (const rows of slots.values()) {
    if (new Set(rows.map((row) => normalize(row.className))).size <= 1) continue;
    for (const row of rows) blockingErrors.push(`CSV source row ${row.rowNumber} | Teacher: ${row.teacherName} | Teacher double-booking after resolving teacher mapping.`);
  }
  if (!preview.rows.length) blockingErrors.push("No valid timetable rows were detected");
  if (preview.invalidRows.length) blockingErrors.push(...preview.invalidRows.map((row) => `CSV source row ${row.rowNumber} is invalid.`));
  return { blockingErrors, duplicateRows };
};

export const canConfirmTimetableImport = (
  preview: TimetableImportValidation,
  mappings: Record<string, string>,
) => {
  const validation = resolveTimetableImportValidation(preview, mappings);
  return validation.blockingErrors.length === 0 &&
  validation.duplicateRows.length === 0 &&
  preview.invalidRows.length === 0 &&
  preview.teacherMatches.every(
    (match) => match.status !== "ambiguous" || Boolean(mappings[match.sourceName]),
  );
};

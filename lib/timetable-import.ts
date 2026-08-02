export type TimetableTeacherMatch = {
  sourceName: string;
  status: "matched" | "new" | "ambiguous";
};

export type TimetableImportValidation = {
  blockingErrors: string[];
  duplicateRows: number[];
  invalidRows: Array<{ rowNumber: number }>;
  teacherMatches: TimetableTeacherMatch[];
};

export const canConfirmTimetableImport = (
  preview: TimetableImportValidation,
  mappings: Record<string, string>,
) =>
  preview.blockingErrors.length === 0 &&
  preview.duplicateRows.length === 0 &&
  preview.invalidRows.length === 0 &&
  preview.teacherMatches.every(
    (match) => match.status !== "ambiguous" || Boolean(mappings[match.sourceName]),
  );

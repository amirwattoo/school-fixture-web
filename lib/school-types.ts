export type TeachingLevel = "LOWER" | "HIGHER" | "BOTH";
export type DayOfWeek =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type Teacher = {
  id: string;
  name: string;
  employeeCode: string;
  whatsappNumber: string | null;
  subjectSpecializations: string[];
  teachingLevel: TeachingLevel;
  baseWeeklyTeachingPeriods: number;
  isActive: boolean;
};

export type Subject = {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
};

export type ClassSection = {
  id: string;
  name: string;
  gradeNumber: number | null;
  section: string;
  teachingLevel: TeachingLevel;
  isActive: boolean;
};

export type TimetableEntry = {
  id: string;
  dayOfWeek: DayOfWeek;
  periodNumber: number;
  classSectionId: string;
  teacherId: string;
  subjectId: string;
  teacher: Pick<Teacher, "id" | "name" | "employeeCode" | "isActive">;
  classSection: Pick<
    ClassSection,
    "id" | "name" | "gradeNumber" | "section" | "isActive"
  >;
  subject: Pick<Subject, "id" | "name" | "code" | "isActive">;
};

export type AttendanceStatus =
  "PRESENT" | "ABSENT" | "LEAVE" | "LATE" | "SHORT_LEAVE" | "PARTIAL_DAY";
export type FixtureStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type WhatsAppStatus = "READY" | "OPENED" | "MANUALLY_CONFIRMED";

export type AttendanceRecord = {
  id: string;
  date: string;
  teacherId: string;
  status: AttendanceStatus;
  availableFromPeriod: number | null;
  unavailableFromPeriod: number | null;
  reason: string | null;
  notes: string | null;
  remarks: string | null;
  teacher: Pick<Teacher, "id" | "name" | "employeeCode" | "isActive">;
};

export type ScoredCandidate = {
  teacherId: string;
  teacherName: string;
  subjectScore: number;
  classLevelScore: number;
  workloadScore: number;
  baseWeeklyTeachingPeriods: number;
  weeklyFixtureCount: number;
  effectiveWeeklyWorkload: number;
  minimumEligibleWorkload: number;
  maximumEligibleWorkload: number;
  totalScore: number;
};

export type ExcludedFixtureTeacher = {
  teacherId: string;
  teacherName: string;
  reason:
    | "ABSENT"
    | "ON_LEAVE"
    | "NOT_ARRIVED_YET"
    | "LEFT_ON_SHORT_LEAVE"
    | "OUTSIDE_PARTIAL_DAY_RANGE"
    | "TEACHING_CLASS"
    | "ALREADY_ASSIGNED_FIXTURE"
    | "INACTIVE"
    | "ORIGINAL_ABSENT_TEACHER"
    | "ALREADY_SELECTED_FOR_FIXTURE";
};

export type ScoringDetails = {
  requiredSubject: string;
  requiredTeachingLevel: TeachingLevel;
  selectedTeacherId: string | null;
  candidates: ScoredCandidate[];
  excluded?: ExcludedFixtureTeacher[];
};

export type ProxyFixture = {
  id: string;
  date: string;
  periodNumber: number;
  masterTimetableId: string | null;
  classSectionId: string;
  subjectId: string;
  absentTeacherId: string;
  assignedTeacherId: string | null;
  assignmentVersion: number;
  autoAssignedTeacherId: string | null;
  status: FixtureStatus;
  autoScore: number | null;
  scoringDetails: ScoringDetails | null;
  isManuallyOverridden: boolean;
  overrideReason: string | null;
  workloadCounted: boolean;
  requiresReassignment: boolean;
  reassignmentReason: string | null;
  classSection: Pick<
    ClassSection,
    "id" | "name" | "gradeNumber" | "section" | "teachingLevel"
  >;
  subject: Pick<Subject, "id" | "name" | "code">;
  absentTeacher: Pick<Teacher, "id" | "name" | "employeeCode">;
  assignedTeacher: Pick<
    Teacher,
    "id" | "name" | "employeeCode" | "whatsappNumber"
  > | null;
  autoAssignedTeacher: Pick<Teacher, "id" | "name" | "employeeCode"> | null;
};

export type WhatsAppNotification = {
  id: string;
  fixtureId: string;
  teacherId: string;
  destination: string;
  message: string;
  status: WhatsAppStatus;
  idempotencyKey: string;
  attemptCount: number;
  lastAttemptAt: string | null;
  openedAt: string | null;
  manuallyConfirmedAt: string | null;
  normalizedDestination: string;
  clickToChatUrl: string | null;
  clickToChatError: {
    code: string;
    message: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  teacher: Pick<Teacher, "id" | "name" | "employeeCode" | "whatsappNumber">;
  fixture: {
    id: string;
    date: string;
    periodNumber: number;
    classSection: Pick<ClassSection, "id" | "name">;
    subject: Pick<Subject, "id" | "name">;
    absentTeacher: Pick<Teacher, "id" | "name" | "employeeCode">;
    assignedTeacher: Pick<
      Teacher,
      "id" | "name" | "employeeCode" | "whatsappNumber"
    > | null;
  };
};

export type Pagination = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type WhatsAppProviderStatus = {
  provider: "click_to_chat";
  mode: "Click-to-Chat";
  configured: boolean;
  automaticDelivery: false;
  deliveryConfirmation: "manual";
};

export type FixtureRecordRow = {
  teacherId: string;
  teacherName: string;
  employeeCode: string;
  fixtureCount: number;
  isActive: boolean;
};

export const DAYS: DayOfWeek[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

export const readableEnum = (value: string) =>
  value
    .toLocaleLowerCase("en")
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");

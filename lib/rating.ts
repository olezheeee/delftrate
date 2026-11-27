// The rules of a rating that do not need a database: checking what the browser sends,
// turning database errors into sentences, and deciding who may rate.
import { programmeName } from "./auth/programmes";
import { PROFESSOR_CRITERIA, SUBJECT_CRITERIA } from "./course-sheet";

export type SubjectKey = (typeof SUBJECT_CRITERIA)[number]["key"];
export type ProfessorKey = (typeof PROFESSOR_CRITERIA)[number]["key"];

// The six values in the order of submit_rating's arguments.
export const RATING_KEYS: readonly (SubjectKey | ProfessorKey)[] = [
  ...SUBJECT_CRITERIA.map((criterion) => criterion.key),
  ...PROFESSOR_CRITERIA.map((criterion) => criterion.key),
];

// What the form sends to the server: the course, the professor and all six values.
export type RatingInput = {
  courseId: string;
  professorId: string;
  values: Record<SubjectKey | ProfessorKey, number>;
};

// The signed-in user's own saved rating of one course.
export type OwnRating = {
  subject: Record<SubjectKey, number> | null;
  // Keyed by professor id; only professors this user has rated.
  professors: Record<string, Record<ProfessorKey, number>>;
};

const MISSING = "Set all six sliders before posting.";
const OUT_OF_RANGE = "Every value must be between 0 and 10, in half-point steps.";
const BROKEN = "This rating could not be saved. Reload the page and try again.";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Same rule as private.is_rating_value in the database.
export function isRatingValue(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 10 && Number.isInteger(value * 2);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The input comes from the browser, so nothing in it is trusted.
export function parseRating(input: unknown): { ok: true; data: RatingInput } | { ok: false; error: string } {
  if (!isObject(input)) return { ok: false, error: BROKEN };
  const { courseId, professorId, values } = input;
  if (typeof courseId !== "string" || !UUID.test(courseId)) return { ok: false, error: BROKEN };
  if (typeof professorId !== "string" || !UUID.test(professorId)) return { ok: false, error: BROKEN };
  if (!isObject(values)) return { ok: false, error: BROKEN };

  if (RATING_KEYS.some((key) => values[key] === undefined || values[key] === null)) {
    return { ok: false, error: MISSING };
  }
  if (!RATING_KEYS.every((key) => isRatingValue(values[key]))) return { ok: false, error: OUT_OF_RANGE };

  const clean = {} as RatingInput["values"];
  for (const key of RATING_KEYS) clean[key] = values[key] as number;
  return { ok: true, data: { courseId, professorId, values: clean } };
}

// Turns an error of submit_rating into a sentence for the student.
export function ratingErrorMessage(error: { code?: string; message?: string }): string {
  const message = error.message ?? "";
  switch (error.code) {
    case "42501":
      if (/own programme/i.test(message)) return "You can rate only courses of your own programme.";
      if (/sign in/i.test(message)) return "Sign in to rate a course.";
      break;
    case "23502":
      return MISSING;
    case "23514":
      return OUT_OF_RANGE;
    case "23503":
      return "This professor is no longer listed for this course, so your rating was not saved. Pick another professor.";
  }
  return "Your rating could not be saved. Please try again in a moment.";
}

// The course card's slider state: a subject value under its key, a professor value
// under "<professor id>:<key>".
export function startingValues(own: OwnRating): Record<string, number> {
  const values: Record<string, number> = {};
  if (own.subject) {
    for (const { key } of SUBJECT_CRITERIA) values[key] = own.subject[key];
  }
  for (const [professorId, rated] of Object.entries(own.professors)) {
    for (const { key } of PROFESSOR_CRITERIA) values[`${professorId}:${key}`] = rated[key];
  }
  return values;
}

// Why the sliders are locked. An account without a profile never gets here: the course
// page sends it to the account page first.
export type RatingLock = "other-programme" | "no-professor";

export function ratingLock(args: {
  userProgramme: string;
  courseProgramme: string;
  professorCount: number;
}): RatingLock | null {
  if (args.userProgramme !== args.courseProgramme) return "other-programme";
  if (args.professorCount === 0) return "no-professor";
  return null;
}

export function ratingLockMessage(lock: RatingLock, courseProgramme: string): string {
  switch (lock) {
    case "other-programme":
      return `You can rate only courses of your own programme. This one is part of ${programmeName(courseProgramme)}.`;
    case "no-professor":
      return "This course can be rated once a professor is listed for it.";
  }
}

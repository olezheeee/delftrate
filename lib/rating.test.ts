import { describe, expect, it } from "vitest";
import { programmeName } from "./auth/programmes";
import {
  RATING_KEYS,
  isRatingValue,
  parseRating,
  ratingErrorMessage,
  ratingLock,
  ratingLockMessage,
  startingValues,
} from "./rating";

const COURSE = "123e4567-e89b-12d3-a456-426614174000";
const PROF = "A1B2C3D4-0000-4000-8000-000000000001";
const values = () => ({ difficulty: 5, exam_level: 6.5, interest: 7, engagement: 0, understanding: 10, approachability: 3.5 });
const MISSING = "Set all six sliders before posting.";
const RANGE = "Every value must be between 0 and 10, in half-point steps.";
const BROKEN = "This rating could not be saved. Reload the page and try again.";

describe("isRatingValue", () => {
  it("accepts half steps from 0 to 10", () => {
    for (const v of [0, 0.5, 5, 9.5, 10]) expect(isRatingValue(v)).toBe(true);
  });
  it("rejects everything else", () => {
    for (const v of [-0.5, 10.5, 7.2, 7.25, NaN, Infinity, "5", null, undefined]) expect(isRatingValue(v)).toBe(false);
  });
});

describe("parseRating", () => {
  it("accepts a valid rating", () => {
    expect(parseRating({ courseId: COURSE, professorId: PROF, values: values() })).toEqual({
      ok: true,
      data: { courseId: COURSE, professorId: PROF, values: values() },
    });
  });
  it("drops extra keys", () => {
    const result = parseRating({ courseId: COURSE, professorId: PROF, extra: 1, values: { ...values(), other: 4 } });
    expect(result).toEqual({ ok: true, data: { courseId: COURSE, professorId: PROF, values: values() } });
    if (result.ok) expect(Object.keys(result.data.values)).toHaveLength(6);
  });
  it.each(RATING_KEYS)("reports %s missing", (key) => {
    const missing: Record<string, unknown> = values();
    delete missing[key];
    expect(parseRating({ courseId: COURSE, professorId: PROF, values: missing })).toEqual({ ok: false, error: MISSING });
    expect(parseRating({ courseId: COURSE, professorId: PROF, values: { ...missing, [key]: null } })).toEqual({
      ok: false,
      error: MISSING,
    });
  });
  it.each([-0.5, 10.5, 7.2, 7.25, NaN, Infinity, "5"])("rejects the value %s", (bad) => {
    expect(parseRating({ courseId: COURSE, professorId: PROF, values: { ...values(), interest: bad } })).toEqual({
      ok: false,
      error: RANGE,
    });
  });
  it("rejects bad ids", () => {
    for (const bad of ["nope", "", 5, null, undefined, COURSE + "0"]) {
      expect(parseRating({ courseId: bad, professorId: PROF, values: values() })).toEqual({ ok: false, error: BROKEN });
      expect(parseRating({ courseId: COURSE, professorId: bad, values: values() })).toEqual({ ok: false, error: BROKEN });
    }
  });
  it("rejects input that is not an object", () => {
    for (const bad of [null, undefined, "x", 4, [], { courseId: COURSE, professorId: PROF }, { courseId: COURSE, professorId: PROF, values: "x" }]) {
      expect(parseRating(bad)).toEqual({ ok: false, error: BROKEN });
    }
  });
});

describe("ratingErrorMessage", () => {
  it("maps every code", () => {
    expect(ratingErrorMessage({ code: "42501", message: "You can rate only courses of your own programme." })).toBe(
      "You can rate only courses of your own programme.",
    );
    expect(ratingErrorMessage({ code: "42501", message: "Sign in to rate a course." })).toBe("Sign in to rate a course.");
    expect(ratingErrorMessage({ code: "23502" })).toBe(MISSING);
    expect(ratingErrorMessage({ code: "23514" })).toBe(RANGE);
    expect(ratingErrorMessage({ code: "23503" })).toBe(
      "This professor is no longer listed for this course, so your rating was not saved. Pick another professor.",
    );
  });
  it("falls back for anything else", () => {
    const fallback = "Your rating could not be saved. Please try again in a moment.";
    expect(ratingErrorMessage({ code: "42501", message: "Something else" })).toBe(fallback);
    expect(ratingErrorMessage({ code: "XX000", message: "boom" })).toBe(fallback);
    expect(ratingErrorMessage({})).toBe(fallback);
  });
});

describe("startingValues", () => {
  const subject = { difficulty: 1, exam_level: 2, interest: 3 };
  const professor = { engagement: 4, understanding: 5, approachability: 6 };
  it("is empty for nothing", () => {
    expect(startingValues({ subject: null, professors: {} })).toEqual({});
  });
  it("reads the subject only", () => {
    expect(startingValues({ subject: subject, professors: {} })).toEqual(subject);
  });
  it("reads professors only", () => {
    expect(startingValues({ subject: null, professors: { p1: professor } })).toEqual({
      "p1:engagement": 4,
      "p1:understanding": 5,
      "p1:approachability": 6,
    });
  });
  it("reads both", () => {
    expect(startingValues({ subject, professors: { p1: professor, p2: professor } })).toEqual({
      ...subject,
      "p1:engagement": 4,
      "p1:understanding": 5,
      "p1:approachability": 6,
      "p2:engagement": 4,
      "p2:understanding": 5,
      "p2:approachability": 6,
    });
  });
});

describe("ratingLock", () => {
  it("checks the programme first, then the professors", () => {
    expect(ratingLock({ userProgramme: "AE", courseProgramme: "CSE", professorCount: 0 })).toBe("other-programme");
    expect(ratingLock({ userProgramme: "CSE", courseProgramme: "CSE", professorCount: 0 })).toBe("no-professor");
    expect(ratingLock({ userProgramme: "CSE", courseProgramme: "CSE", professorCount: 2 })).toBeNull();
  });
  it("words the two locks", () => {
    expect(ratingLockMessage("other-programme", "CSE")).toBe(
      `You can rate only courses of your own programme. This one is part of ${programmeName("CSE")}.`,
    );
    expect(ratingLockMessage("no-professor", "CSE")).toBe("This course can be rated once a professor is listed for it.");
  });
});

import { describe, expect, it } from "vitest";
import { buildCourseSheet } from "./course-sheet";
import type { ProfessorStatsRow, SubjectStatsRow } from "./score";

const COURSE = "c";

function subject(votes: number, values: [number, number, number] | null): SubjectStatsRow {
  return {
    course_id: COURSE,
    difficulty: values?.[0] ?? null,
    exam_level: values?.[1] ?? null,
    interest: values?.[2] ?? null,
    difficulty_votes: votes,
    exam_level_votes: votes,
    interest_votes: votes,
    votes,
    enough_votes: values !== null,
  };
}

function professor(id: string, votes: number, value: number | null, hidden = false): ProfessorStatsRow {
  return {
    course_id: COURSE,
    professor_id: id,
    hidden,
    engagement: value,
    understanding: value,
    approachability: value,
    engagement_votes: votes,
    understanding_votes: votes,
    approachability_votes: votes,
    votes,
    enough_votes: value !== null,
  };
}

const ADA = { id: "a", name: "Ada", hidden: false };
const BOB = { id: "b", name: "Bob", hidden: false };

describe("the course sheet", () => {
  it("shows the averages and the combined score once both blocks have enough votes", () => {
    const sheet = buildCourseSheet([ADA], subject(12, [8, 8, 6]), [professor("a", 10, 9)]);
    expect(sheet.subject).toEqual({
      votes: 12,
      averages: { difficulty: 8, exam_level: 8, interest: 6 },
      load: 8,
    });
    expect(sheet.professors).toHaveLength(1);
    expect(sheet.professors[0]).toMatchObject({ id: "a", name: "Ada", votes: 10, teach: 9 });
    // 0.6 * 9 + 0.25 * 6 + 0.15 * (10 - 8)
    expect(sheet.professors[0].combined?.score).toBeCloseTo(7.2);
    expect(sheet.professors[0].combined?.verdict).toBe("hard-well-taught");
  });

  it("gives the vote count and no numbers while a block is below the minimum", () => {
    const sheet = buildCourseSheet([ADA], subject(9, null), [professor("a", 4, null)]);
    expect(sheet.subject).toEqual({ votes: 9, averages: null, load: null });
    expect(sheet.professors[0]).toMatchObject({ votes: 4, averages: null, teach: null, combined: null });
  });

  it("has no combined score while only one of the two blocks has enough votes", () => {
    expect(buildCourseSheet([ADA], subject(9, null), [professor("a", 10, 9)]).professors[0].combined).toBeNull();
    expect(buildCourseSheet([ADA], subject(10, [5, 5, 5]), [professor("a", 9, null)]).professors[0].combined).toBeNull();
  });

  it("starts on the best rated professor with enough votes", () => {
    const sheet = buildCourseSheet([ADA, BOB], subject(10, [5, 5, 5]), [professor("a", 10, 7), professor("b", 10, 9)]);
    expect(sheet.professors.map((p) => p.name)).toEqual(["Ada", "Bob"]);
    expect(sheet.startProfessorId).toBe("b");
  });

  it("starts on the first professor when none has enough votes, and on nobody without professors", () => {
    expect(buildCourseSheet([BOB, ADA], null, []).startProfessorId).toBe("a");
    const empty = buildCourseSheet([], null, []);
    expect(empty).toEqual({ subject: { votes: 0, averages: null, load: null }, professors: [], startProfessorId: null });
  });

  it("leaves a hidden professor out, also when an admin receives the row", () => {
    const hidden = { id: "h", name: "Hidden", hidden: true };
    const sheet = buildCourseSheet([ADA, hidden], subject(10, [5, 5, 5]), [
      professor("a", 10, 6),
      professor("h", 10, 10, true),
    ]);
    expect(sheet.professors.map((p) => p.id)).toEqual(["a"]);
    expect(sheet.startProfessorId).toBe("a");
  });
});

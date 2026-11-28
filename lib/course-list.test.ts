import { describe, expect, it } from "vitest";
import {
  buildCourseList,
  filterCourses,
  matchesQuery,
  programmeCounts,
  sortCourses,
  type CourseListEntry,
  type CourseRow,
  type ProfessorLinkRow,
} from "./course-list";
import type { ProfessorStatsRow, SubjectStatsRow } from "./score";

function subject(course: string, votes: number, values: [number, number, number] | null): SubjectStatsRow {
  return {
    course_id: course,
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

function professorStats(course: string, id: string, votes: number, value: number | null, hidden = false): ProfessorStatsRow {
  return {
    course_id: course,
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

function course(id: string, code: string, name: string, programme = "AE"): CourseRow {
  return { id, code, name, programme_id: programme, year: 1, quarters: [1] };
}

function link(courseId: string, id: string, name: string, hidden = false): ProfessorLinkRow {
  return { course_id: courseId, professors: { id, name, hidden } };
}

// Three courses given out of code order: c2 is the hardest, c1 is easy, c3 has too few votes.
const COURSES = [
  course("c3", "CSE3", "Algorithms", "CSE"),
  course("c1", "AE1", "Calculus"),
  course("c2", "AE2", "Dynamics"),
];
const LINKS = [
  link("c1", "p1", "Ada Müller"),
  link("c2", "p2", "Bob Jansen"),
  link("c2", "p3", "Cleo Bakker"),
  link("c2", "ph", "Hidden Person", true),
  link("c3", "p4", "Dirk de Vries"),
];
const SUBJECTS = [
  subject("c1", 20, [3, 3, 8]),
  subject("c2", 40, [9, 9, 5]),
  subject("c3", 5, null),
];
const PROFESSORS = [
  professorStats("c1", "p1", 15, 8),
  professorStats("c2", "p2", 12, 5),
  professorStats("c2", "p3", 12, 9),
  professorStats("c2", "ph", 30, 10, true),
  professorStats("c3", "p4", 11, 7),
];

const ENTRIES = buildCourseList(COURSES, LINKS, SUBJECTS, PROFESSORS);
const entry = (code: string) => ENTRIES.find((e) => e.code === code)!;
const codes = (list: readonly CourseListEntry[]) => list.map((e) => e.code);

describe("building the course list", () => {
  it("has one entry per course, in code order", () => {
    expect(codes(ENTRIES)).toEqual(["AE1", "AE2", "CSE3"]);
    expect(entry("CSE3")).toMatchObject({ programme: "CSE", programmeName: "Computer Science and Engineering", year: 1, quarters: [1] });
  });

  it("scores a course with its best rated visible professor", () => {
    const ae2 = entry("AE2");
    expect(ae2.professor?.id).toBe("p3");
    expect(ae2.score).toBe(ae2.professor?.combined?.score);
    expect(ae2.score).not.toBeNull();
    expect(ae2.verdict).toBe(ae2.professor?.combined?.verdict);
    expect(ae2.votes).toBe(40);
  });

  it("has no score when the subject has too few votes, but still lists the professors", () => {
    const cse3 = entry("CSE3");
    expect(cse3.score).toBeNull();
    expect(cse3.verdict).toBeNull();
    expect(cse3.votes).toBe(5);
    expect(cse3.sheet.professors.map((p) => p.name)).toEqual(["Dirk de Vries"]);
  });

  it("leaves a hidden professor out of the list, the search and the score", () => {
    const ae2 = entry("AE2");
    expect(ae2.sheet.professors.map((p) => p.id)).toEqual(["p2", "p3"]);
    expect(ae2.professor?.id).not.toBe("ph");
    expect(matchesQuery(ae2, "hidden")).toBe(false);
    // The hidden professor has the best numbers; the score is the one of the visible best.
    const without = buildCourseList(COURSES, LINKS.filter((l) => l.professors?.id !== "ph"), SUBJECTS, PROFESSORS.filter((p) => p.professor_id !== "ph"));
    expect(ae2.score).toBe(without.find((e) => e.code === "AE2")!.score);
  });

  it("handles a course without professors or ratings", () => {
    const [bare] = buildCourseList([course("x", "X1", "Bare")], [], [], []);
    expect(bare).toMatchObject({ professor: null, score: null, verdict: null, votes: 0 });
    expect(bare.sheet.professors).toEqual([]);
  });
});

describe("searching", () => {
  it("finds by code, name, professor and programme", () => {
    expect(codes(ENTRIES.filter((e) => matchesQuery(e, "ae2")))).toEqual(["AE2"]);
    expect(codes(ENTRIES.filter((e) => matchesQuery(e, "calc")))).toEqual(["AE1"]);
    expect(codes(ENTRIES.filter((e) => matchesQuery(e, "bakker")))).toEqual(["AE2"]);
    expect(codes(ENTRIES.filter((e) => matchesQuery(e, "aerospace")))).toEqual(["AE1", "AE2"]);
    expect(codes(ENTRIES.filter((e) => matchesQuery(e, "cse")))).toEqual(["CSE3"]);
  });

  it("ignores case and accents", () => {
    expect(matchesQuery(entry("AE1"), "MULLER")).toBe(true);
    expect(matchesQuery(entry("AE1"), "müller")).toBe(true);
  });

  it("needs every word, each in any field", () => {
    expect(matchesQuery(entry("AE1"), "calculus muller")).toBe(true);
    expect(matchesQuery(entry("AE1"), "calculus jansen")).toBe(false);
  });

  it("matches everything for an empty query", () => {
    expect(ENTRIES.every((e) => matchesQuery(e, ""))).toBe(true);
    expect(ENTRIES.every((e) => matchesQuery(e, "  \t "))).toBe(true);
  });
});

describe("filtering", () => {
  it("combines the programme with the query", () => {
    expect(codes(filterCourses(ENTRIES, { programme: "ALL", query: "" }))).toEqual(["AE1", "AE2", "CSE3"]);
    expect(codes(filterCourses(ENTRIES, { programme: "AE", query: "" }))).toEqual(["AE1", "AE2"]);
    expect(codes(filterCourses(ENTRIES, { programme: "AE", query: "dyn" }))).toEqual(["AE2"]);
    expect(codes(filterCourses(ENTRIES, { programme: "CSE", query: "dyn" }))).toEqual([]);
  });
});

describe("sorting", () => {
  it("puts the hardest first and the unscored last", () => {
    expect(codes(sortCourses(ENTRIES, "hardest"))).toEqual(["AE2", "AE1", "CSE3"]);
  });

  it("puts the easiest first and the unscored last", () => {
    expect(codes(sortCourses(ENTRIES, "easiest"))).toEqual(["AE1", "AE2", "CSE3"]);
  });

  it("puts the unscored in code order after the scored", () => {
    const extra = buildCourseList([...COURSES, course("c0", "AE0", "Zero")], LINKS, SUBJECTS, PROFESSORS);
    expect(codes(sortCourses(extra, "hardest"))).toEqual(["AE2", "AE1", "AE0", "CSE3"]);
    expect(codes(sortCourses(extra, "easiest"))).toEqual(["AE1", "AE2", "AE0", "CSE3"]);
  });

  it("sorts on votes and on name", () => {
    expect(codes(sortCourses(ENTRIES, "most"))).toEqual(["AE2", "AE1", "CSE3"]);
    expect(codes(sortCourses(ENTRIES, "az"))).toEqual(["CSE3", "AE1", "AE2"]);
  });

  it("breaks ties on the code whatever the input order", () => {
    const same = buildCourseList(
      [course("a", "AE9", "Same"), course("b", "AE5", "Same"), course("c", "AE7", "Same")],
      [],
      [],
      [],
    );
    for (const sort of ["hardest", "easiest", "most", "az"] as const) {
      expect(codes(sortCourses(same, sort))).toEqual(["AE5", "AE7", "AE9"]);
      expect(codes(sortCourses([...same].reverse(), sort))).toEqual(["AE5", "AE7", "AE9"]);
    }
  });

  it("treats scores that differ only by floating point noise as a tie", () => {
    // (7.7 + 7.9) / 2 is 7.800000000000001 in JavaScript; both show as 7.8.
    const noisy = { ...entry("AE1"), code: "AE9", score: (7.7 + 7.9) / 2 };
    const exact = { ...entry("AE1"), code: "AE5", score: 7.8 };
    expect(codes(sortCourses([noisy, exact], "hardest"))).toEqual(["AE5", "AE9"]);
    expect(codes(sortCourses([noisy, exact], "easiest"))).toEqual(["AE5", "AE9"]);
  });

  it("returns a new array and leaves the input alone", () => {
    const before = codes(ENTRIES);
    const sorted = sortCourses(ENTRIES, "az");
    expect(sorted).not.toBe(ENTRIES);
    expect(codes(ENTRIES)).toEqual(before);
  });
});

describe("programme counts", () => {
  it("counts all courses and each programme", () => {
    expect(programmeCounts(ENTRIES, "")).toEqual([
      { id: "ALL", label: "All", count: 3 },
      { id: "AE", label: "AE", count: 2 },
      { id: "CSE", label: "CSE", count: 1 },
    ]);
  });

  it("counts only the courses that match the query", () => {
    expect(programmeCounts(ENTRIES, "dirk")).toEqual([
      { id: "ALL", label: "All", count: 1 },
      { id: "AE", label: "AE", count: 0 },
      { id: "CSE", label: "CSE", count: 1 },
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  combinedScore,
  courseScore,
  defaultProfessor,
  load,
  scoreWithProfessor,
  teach,
  verdict,
  VERDICT_LABELS,
  type ProfessorStats,
  type SubjectStats,
} from "./score";

// The example courses of the demo (index.html): subject averages, professor averages, and
// the load, teaching score and verdict the demo shows for them. The combined score is not
// the demo's any more: it is the overall difficulty (65% load, 23% teaching and 12%
// interest, the last two the other way round), worked out by hand for each course.
const DEMO: [string, number[], number[], string, string, string, string][] = [
  ["Calculus for Engineers", [7.2, 7.6, 7.0], [9.1, 9.6, 8.9], "7.4", "9.2", "5.4", "Smooth ride"],
  ["Algorithms and Data Structures", [7.8, 8.2, 8.8], [9.2, 8.8, 8.3], "8.0", "8.8", "5.6", "Hard, but well taught"],
  ["Aerodynamics I", [8.1, 8.0, 9.2], [9.0, 9.3, 8.7], "8.1", "9.0", "5.6", "Hard, but well taught"],
  ["Orbital Mechanics", [9.1, 9.4, 8.6], [7.4, 6.3, 6.6], "9.3", "6.8", "6.9", "Brace yourself"],
  ["Structural Mechanics 2", [8.4, 8.1, 6.8], [7.8, 8.7, 9.1], "8.3", "8.5", "6.1", "Hard, but well taught"],
  ["Fluid Mechanics", [7.6, 7.2, 8.2], [9.6, 9.7, 9.4], "7.4", "9.6", "5.1", "Smooth ride"],
  ["Design Studio: Housing", [6.2, 4.8, 9.0], [9.2, 7.6, 8.8], "5.5", "8.5", "4.0", "Smooth ride"],
  ["Thermodynamics", [8.6, 8.9, 6.4], [7.0, 7.5, 7.1], "8.8", "7.2", "6.8", "Brace yourself"],
  ["Control Systems", [8.0, 7.7, 8.4], [9.0, 9.1, 8.8], "7.8", "9.0", "5.5", "Hard, but well taught"],
  ["Human-Centred Design", [4.6, 4.2, 8.6], [9.4, 8.5, 9.0], "4.4", "9.0", "3.3", "Smooth ride"],
  ["Systems Modelling", [5.8, 6.1, 7.2], [8.0, 8.1, 8.2], "5.9", "8.1", "4.6", "Smooth ride"],
  ["Quantum Mechanics 1", [9.4, 9.0, 8.9], [7.0, 6.1, 6.4], "9.2", "6.5", "6.9", "Brace yourself"],
];

describe("the demo's numbers", () => {
  it.each(DEMO)("%s", (_name, s, p, shownLoad, shownTeach, shownScore, shownVerdict) => {
    const subject = { difficulty: s[0], exam_level: s[1], interest: s[2] };
    const professor = { engagement: p[0], understanding: p[1], approachability: p[2] };
    expect(load(subject).toFixed(1)).toBe(shownLoad);
    expect(teach(professor).toFixed(1)).toBe(shownTeach);
    expect(combinedScore(subject, professor).toFixed(1)).toBe(shownScore);
    expect(VERDICT_LABELS[verdict(subject, professor)]).toBe(shownVerdict);
  });
});

describe("verdict", () => {
  const subject = (l: number) => ({ difficulty: l, exam_level: l, interest: 5 });
  const professor = (t: number) => ({ engagement: t, understanding: t, approachability: t });

  it("calls a load of exactly 7.5 hard and a teaching score of exactly 8 good", () => {
    expect(verdict(subject(7.5), professor(8))).toBe("hard-well-taught");
    expect(verdict(subject(7.5), professor(7.9))).toBe("brace-yourself");
    expect(verdict(subject(7.4), professor(8))).toBe("smooth-ride");
    expect(verdict(subject(7.4), professor(7.9))).toBe("manageable-solo");
  });
});

const subjectStats = (over: Partial<SubjectStats> = {}): SubjectStats => ({
  difficulty: 7.2,
  exam_level: 7.6,
  interest: 7.0,
  enough_votes: true,
  ...over,
});

const professorStats = (id: string, t: number | null, over: Partial<ProfessorStats> = {}): ProfessorStats => ({
  professor_id: id,
  hidden: false,
  engagement: t,
  understanding: t,
  approachability: t,
  votes: 20,
  enough_votes: true,
  ...over,
});

describe("floating point noise", () => {
  // (7.1 + 9.2 + 7.7) / 3 is 7.999999999999999 in plain floating point.
  const eight = { engagement: 7.1, understanding: 9.2, approachability: 7.7 };

  it("does not push a teaching score of exactly 8 below the threshold", () => {
    expect(teach(eight)).toBeLessThan(8);
    expect(verdict({ difficulty: 5, exam_level: 5, interest: 5 }, eight)).toBe("smooth-ride");
  });

  it("does not decide between two professors with the same teaching score", () => {
    const noisy = { ...professorStats("noisy", 8, { votes: 12 }), ...eight };
    const exact = professorStats("exact", 8, { votes: 30 });
    expect(defaultProfessor([noisy, exact])?.professor_id).toBe("exact");
    expect(defaultProfessor([exact, noisy])?.professor_id).toBe("exact");
  });
});

describe("defaultProfessor", () => {
  it("is the best rated professor", () => {
    const rows = [professorStats("a", 7), professorStats("b", 9), professorStats("c", 8)];
    expect(defaultProfessor(rows)?.professor_id).toBe("b");
  });

  it("skips a professor without enough votes, as a student receives the row", () => {
    const rows = [professorStats("a", 7), professorStats("b", null, { votes: 9, enough_votes: false })];
    expect(defaultProfessor(rows)?.professor_id).toBe("a");
  });

  it("skips a professor without enough votes, as an admin receives the row", () => {
    const rows = [professorStats("a", 7), professorStats("b", 9.5, { votes: 9, enough_votes: false })];
    expect(defaultProfessor(rows)?.professor_id).toBe("a");
  });

  it("skips a hidden professor", () => {
    const rows = [professorStats("a", 7), professorStats("b", 9.5, { hidden: true })];
    expect(defaultProfessor(rows)?.professor_id).toBe("a");
  });

  it("is null when nobody qualifies", () => {
    expect(defaultProfessor([])).toBeNull();
    expect(defaultProfessor([professorStats("a", 9, { hidden: true })])).toBeNull();
    expect(defaultProfessor([professorStats("a", null, { votes: 3, enough_votes: false })])).toBeNull();
  });

  it("breaks a tie by votes, then by id, whatever the order of the rows", () => {
    const few = professorStats("a", 8, { votes: 12 });
    const many = professorStats("b", 8, { votes: 30 });
    expect(defaultProfessor([few, many])?.professor_id).toBe("b");
    expect(defaultProfessor([many, few])?.professor_id).toBe("b");

    const x = professorStats("x", 8);
    const y = professorStats("y", 8);
    expect(defaultProfessor([y, x])?.professor_id).toBe("x");
    expect(defaultProfessor([x, y])?.professor_id).toBe("x");
  });
});

describe("the combined score", () => {
  const subject = (difficulty: number, exam_level: number, interest: number) => ({ difficulty, exam_level, interest });
  const professor = (value: number) => ({ engagement: value, understanding: value, approachability: value });

  it("runs from the easiest course to one that is impossible to pass", () => {
    // No load at all, perfect teaching, as interesting as it gets.
    expect(combinedScore(subject(0, 0, 10), professor(10))).toBe(0);
    // The heaviest load, the worst teaching, no interest.
    expect(combinedScore(subject(10, 10, 0), professor(0))).toBeCloseTo(10, 10);
  });

  it("counts the load for 65%, the teaching for 23% and interest for 12%", () => {
    expect(combinedScore(subject(10, 10, 10), professor(10))).toBeCloseTo(6.5, 10);
    expect(combinedScore(subject(0, 0, 10), professor(0))).toBeCloseTo(2.3, 10);
    expect(combinedScore(subject(0, 0, 0), professor(10))).toBeCloseTo(1.2, 10);
  });

  it("gets higher with a heavier load, and lower with better teaching or more interest", () => {
    const base = combinedScore(subject(7, 7, 7), professor(7));
    expect(combinedScore(subject(8, 7, 7), professor(7))).toBeGreaterThan(base);
    expect(combinedScore(subject(7, 8, 7), professor(7))).toBeGreaterThan(base);
    expect(combinedScore(subject(7, 7, 7), professor(8))).toBeLessThan(base);
    expect(combinedScore(subject(7, 7, 8), professor(7))).toBeLessThan(base);
  });
});

describe("courseScore", () => {
  it("uses the default professor", () => {
    const best = professorStats("best", 9.2);
    const result = courseScore(subjectStats(), [professorStats("other", 7), best]);
    expect(result?.professor_id).toBe("best");
    expect(result?.load.toFixed(1)).toBe("7.4");
    expect(result?.teach.toFixed(1)).toBe("9.2");
    expect(result?.score.toFixed(1)).toBe("5.4");
    expect(result?.verdict).toBe("smooth-ride");
  });

  it("has no score without a default professor", () => {
    expect(courseScore(subjectStats(), [])).toBeNull();
    expect(courseScore(subjectStats(), [professorStats("a", 9, { hidden: true })])).toBeNull();
  });

  it("has no score while the subject has too few votes", () => {
    const professors = [professorStats("a", 9)];
    const asStudent = subjectStats({ difficulty: null, exam_level: null, interest: null, enough_votes: false });
    const asAdmin = subjectStats({ enough_votes: false });
    expect(courseScore(asStudent, professors)).toBeNull();
    expect(courseScore(asAdmin, professors)).toBeNull();
  });
});

describe("scoreWithProfessor", () => {
  it("scores the course with the chosen professor, not the default one", () => {
    const result = scoreWithProfessor(subjectStats(), professorStats("other", 7));
    expect(result?.professor_id).toBe("other");
    expect(result?.teach).toBe(7);
  });

  it("is null for a professor without enough votes or a hidden one", () => {
    expect(scoreWithProfessor(subjectStats(), professorStats("a", 9, { enough_votes: false }))).toBeNull();
    expect(scoreWithProfessor(subjectStats(), professorStats("a", 9, { hidden: true }))).toBeNull();
  });
});

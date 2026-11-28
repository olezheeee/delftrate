import { describe, expect, it } from "vitest";
import { ranksFromRows, studyPlan, type CourseRankRow } from "./course-insights";

describe("ranks from the rows of course_ranks()", () => {
  const row = (professor_id: string | null, values: Partial<CourseRankRow> = {}): CourseRankRow => ({
    professor_id,
    score_rank: null,
    score_of: null,
    teach_rank: null,
    teach_of: null,
    lighter_load: null,
    ...values,
  });

  it("puts each professor's two ranks under their id", () => {
    const ranks = ranksFromRows([
      row("ada", { score_rank: 2, score_of: 5, teach_rank: 1, teach_of: 9, lighter_load: 40 }),
      row("bob", { score_rank: 4, score_of: 5, teach_rank: 7, teach_of: 9, lighter_load: 40 }),
    ]);
    expect(ranks).toEqual({
      available: true,
      score: { ada: { rank: 2, of: 5 }, bob: { rank: 4, of: 5 } },
      professor: { ada: { rank: 1, of: 9 }, bob: { rank: 7, of: 9 } },
      lighterLoad: 40,
    });
  });

  it("leaves out a rank the database left empty", () => {
    const ranks = ranksFromRows([row("ada", { teach_rank: 3, teach_of: 4 }), row("bob")]);
    expect(ranks.score).toEqual({});
    expect(ranks.professor).toEqual({ ada: { rank: 3, of: 4 } });
    expect(ranks.lighterLoad).toBeNull();
  });

  it("keeps the share of lighter courses of a course without a professor", () => {
    expect(ranksFromRows([row(null, { lighter_load: 25 })])).toEqual({
      available: true,
      score: {},
      professor: {},
      lighterLoad: 25,
    });
  });

  it("has no ranks for a course the database knows nothing about", () => {
    expect(ranksFromRows([])).toEqual({ available: true, score: {}, professor: {}, lighterLoad: null });
  });
});

const S = (difficulty: number, exam_level: number, interest: number) => ({ difficulty, exam_level, interest });
const P = (engagement: number, understanding: number, approachability: number) => ({
  engagement,
  understanding,
  approachability,
});

describe("study plan", () => {
  it("describes the workload", () => {
    const p = P(8, 8, 8);
    expect(studyPlan(S(9, 8, 8), p).line.startsWith("One of the most demanding subjects here")).toBe(true);
    expect(studyPlan(S(8, 7, 8), p).line.startsWith("A demanding subject")).toBe(true);
    expect(studyPlan(S(6, 6, 8), p).line.startsWith("A moderate workload")).toBe(true);
    expect(studyPlan(S(5, 5, 8), p).line.startsWith("A light workload")).toBe(true);
  });

  it("describes the teaching", () => {
    const s = S(5, 5, 8);
    expect(studyPlan(s, P(9, 9, 9)).line).toBe("A light workload, taught by one of the best.");
    expect(studyPlan(s, P(8, 8, 8)).line).toBe("A light workload, with teaching you can lean on.");
    expect(studyPlan(s, P(7, 7, 7)).line).toBe("A light workload, with teaching that only gets you part of the way.");
    expect(studyPlan(s, P(6, 6, 6)).line).toBe("A light workload, and you will carry most of it yourself.");
  });

  it("picks the workload tip", () => {
    const p = P(8, 8, 8);
    expect(studyPlan(S(8, 7, 8), p).tips[0]).toMatch(/^Start in week one/);
    expect(studyPlan(S(6, 5, 8), p).tips[0]).toMatch(/^Keep a steady weekly rhythm/);
    expect(studyPlan(S(5, 5, 8), p).tips[0]).toMatch(/^The material is light/);
  });

  it("picks the exam tip", () => {
    const p = P(8, 8, 8);
    expect(studyPlan(S(6.5, 7, 8), p).tips[1]).toMatch(/^The exam is tougher/);
    expect(studyPlan(S(7.8, 7.8, 8), p).tips[1]).toMatch(/^Expect a hard exam/);
    expect(studyPlan(S(5, 5, 8), p).tips[1]).toMatch(/^The exam is fair/);
    expect(studyPlan(S(6, 6, 8), p).tips[1]).toMatch(/^The exam matches/);
  });

  it("treats a threshold exactly on the boundary as reached, despite float noise", () => {
    // 7.4 + 7.6 = 15 -> 7.5; and a difference of 0.3 that is 0.29999999999999893 in floats.
    expect(studyPlan(S(7.4, 7.6, 8), P(8, 8, 8)).line.startsWith("A demanding subject")).toBe(true);
    expect(studyPlan(S(6.7, 7, 8), P(8, 8, 8)).tips[1]).toMatch(/^The exam is tougher/);
    // Engagement 7.5 is not below 7.5; the mean of 7.4999999 and 7.5000001 is tidied.
    expect(studyPlan(S(5, 6, 8), P(7.4999999, 8, 8)).tips[2]).toMatch(/^Lectures are useful/);
    expect(studyPlan(S(5, 6, 8), P(7.4, 8, 8)).tips[2]).toMatch(/^Lectures are dry/);
  });

  it("picks the lecture tip", () => {
    const s = S(5, 6, 8);
    expect(studyPlan(s, P(9, 6.9, 8)).tips[2]).toMatch(/^Explanations often do not land/);
    expect(studyPlan(s, P(8.5, 8.5, 8)).tips[2]).toMatch(/^Go to the lectures/);
    expect(studyPlan(s, P(7, 8, 8)).tips[2]).toMatch(/^Lectures are dry/);
    expect(studyPlan(s, P(8, 8, 8)).tips[2]).toMatch(/^Lectures are useful/);
  });

  it("adds the approachability and interest tips", () => {
    const s = S(5, 6, 8);
    expect(studyPlan(s, P(8, 8, 8.5)).tips[3]).toMatch(/^The professor is easy to reach/);
    expect(studyPlan(s, P(8, 8, 6.9)).tips[3]).toMatch(/^The professor is hard to reach/);
    expect(studyPlan(s, P(8, 8, 8)).tips).toHaveLength(3);
    expect(studyPlan(S(5, 6, 6.9), P(8, 8, 8)).tips[3]).toMatch(/^Students find the topic dry/);
    expect(studyPlan(S(5, 6, 7), P(8, 8, 8)).tips).toHaveLength(3);
  });

  it("returns at most four tips", () => {
    const plan = studyPlan(S(5, 6, 5), P(8, 8, 9));
    expect(plan.tips).toHaveLength(4);
    expect(plan.tips[3]).toMatch(/^The professor is easy to reach/);
  });
});

import { describe, expect, it } from "vitest";
import { courseRanks, studyPlan } from "./course-insights";
import type { ProfessorStatsRow, SubjectStatsRow } from "./score";

function subject(course: string, values: [number, number, number] | null): SubjectStatsRow {
  return {
    course_id: course,
    difficulty: values?.[0] ?? null,
    exam_level: values?.[1] ?? null,
    interest: values?.[2] ?? null,
    difficulty_votes: 20,
    exam_level_votes: 20,
    interest_votes: 20,
    votes: 20,
    enough_votes: values !== null,
  };
}

function prof(course: string, id: string, value: number | null, hidden = false): ProfessorStatsRow {
  return {
    course_id: course,
    professor_id: id,
    hidden,
    engagement: value,
    understanding: value,
    approachability: value,
    engagement_votes: 20,
    understanding_votes: 20,
    approachability_votes: 20,
    votes: 20,
    enough_votes: value !== null,
  };
}

// With subject [5,5,5] (load 5) and professor value v: score = 0.6v + 1.25 + 0.75.
describe("course ranks", () => {
  it("ranks the score among courses, with ties sharing a rank", () => {
    const subjects = [subject("a", [5, 5, 5]), subject("b", [5, 5, 5]), subject("c", [5, 5, 5]), subject("d", [5, 5, 5])];
    const profs = [prof("a", "pa", 8), prof("b", "pb", 9), prof("c", "pc", 8), prof("d", "pd", 6)];
    const a = courseRanks("a", subjects, profs);
    expect(a.score).toEqual({ pa: { rank: 2, of: 4 } });
    expect(courseRanks("c", subjects, profs).score.pc).toEqual({ rank: 2, of: 4 });
    expect(courseRanks("b", subjects, profs).score.pb).toEqual({ rank: 1, of: 4 });
    expect(courseRanks("d", subjects, profs).score.pd).toEqual({ rank: 4, of: 4 });
  });

  it("gives a course without a score no score entries and leaves it out of the others", () => {
    const subjects = [subject("a", null), subject("b", [5, 5, 5]), subject("c", [5, 5, 5])];
    const profs = [prof("a", "pa", 9), prof("b", "pb", 8), prof("c", "pc", 7), prof("d", "pd", 10)];
    expect(courseRanks("a", subjects, profs).score).toEqual({});
    expect(courseRanks("b", subjects, profs).score.pb).toEqual({ rank: 1, of: 2 });
    // A professor with too few votes gets no entry either.
    const few = courseRanks("b", subjects, [...profs, prof("b", "pz", null)]);
    expect(few.score.pz).toBeUndefined();
  });

  it("scores each professor of this course against the other courses", () => {
    const subjects = [subject("a", [5, 5, 5]), subject("b", [5, 5, 5])];
    const profs = [prof("a", "p1", 6), prof("a", "p2", 9), prof("b", "pb", 8)];
    const ranks = courseRanks("a", subjects, profs);
    expect(ranks.score.p1).toEqual({ rank: 2, of: 2 });
    expect(ranks.score.p2).toEqual({ rank: 1, of: 2 });
  });

  it("never counts a hidden professor", () => {
    const subjects = [subject("a", [5, 5, 5]), subject("b", [5, 5, 5])];
    const profs = [prof("a", "pa", 7), prof("a", "ph", 10, true), prof("b", "pb", 9), prof("b", "pbh", 10, true)];
    const ranks = courseRanks("a", subjects, profs);
    expect(ranks.score.ph).toBeUndefined();
    expect(ranks.professor.ph).toBeUndefined();
    // Course b is scored with pb (the hidden one is never its default professor).
    expect(ranks.score.pa).toEqual({ rank: 2, of: 2 });
    expect(ranks.professor.pa).toEqual({ rank: 2, of: 2 });
  });

  it("ranks the teaching score among all visible professor rows with enough votes", () => {
    const subjects = [subject("a", [5, 5, 5]), subject("b", [5, 5, 5])];
    const profs = [
      prof("a", "p1", 8),
      prof("a", "p2", 8),
      prof("b", "p1", 9),
      prof("b", "p3", 5),
      prof("b", "p4", null),
    ];
    const ranks = courseRanks("a", subjects, profs);
    // p1 on b is a separate row: ranks are per (course, professor).
    expect(ranks.professor).toEqual({ p1: { rank: 2, of: 4 }, p2: { rank: 2, of: 4 } });
  });

  it("is robust against float noise in ties", () => {
    const subjects = [subject("a", [5, 5, 5])];
    const profs = [
      { ...prof("a", "p1", 8), engagement: 7.9, understanding: 8, approachability: 8.1 },
      { ...prof("a", "p2", 8), engagement: 8, understanding: 8, approachability: 8 },
    ];
    const ranks = courseRanks("a", subjects, profs);
    expect(ranks.professor.p1.rank).toBe(1);
    expect(ranks.professor.p2.rank).toBe(1);
  });

  it("computes easierThan, null without enough votes or without other courses", () => {
    const subjects = [
      subject("a", [6, 6, 5]),
      subject("b", [2, 2, 5]),
      subject("c", [9, 9, 5]),
      subject("d", [6, 6, 5]),
      subject("e", null),
    ];
    // Others with data: b (lower), c (higher), d (equal) -> 1 of 3.
    expect(courseRanks("a", subjects, []).easierThan).toBe(33);
    expect(courseRanks("c", subjects, []).easierThan).toBe(100);
    expect(courseRanks("b", subjects, []).easierThan).toBe(0);
    expect(courseRanks("e", subjects, []).easierThan).toBeNull();
    expect(courseRanks("a", [subject("a", [6, 6, 5]), subject("e", null)], []).easierThan).toBeNull();
    expect(courseRanks("missing", subjects, []).easierThan).toBeNull();
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

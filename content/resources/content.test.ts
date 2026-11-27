// Checks every resource list and booklet in this folder. To check one course only:
//   npx vitest run content -t CSE21C
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOURS_PER_ECTS,
  crossCheck,
  isCourseCode,
  markedParts,
  parseExamBooklet,
  parseKnowledgeBooklet,
  parseResources,
  topicStatistics,
  type ExamBooklet,
  type KnowledgeBooklet,
} from "@/lib/resources";

const ROOT = import.meta.dirname;
const FILES = ["resources.json", "knowledge.json", "exams.json"];
const courses = readdirSync(ROOT).filter((name) => statSync(join(ROOT, name)).isDirectory());

function read(code: string, file: string): unknown {
  const path = join(ROOT, code, file);
  return existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : undefined;
}

// How much of a set of lines is marked as "know this by heart": the number of marks, and
// their share of the characters.
function marked(lines: string[]): { marks: number; share: number } {
  const parts = lines.flatMap((line) => markedParts(line));
  const all = parts.reduce((sum, part) => sum + part.text.length, 0);
  const inMarks = parts.filter((part) => part.marked);
  return { marks: inMarks.length, share: all === 0 ? 0 : inMarks.reduce((sum, part) => sum + part.text.length, 0) / all };
}

it("has a folder per course, named by its course code", () => {
  expect(courses.length).toBeGreaterThan(0);
  for (const code of courses) expect(isCourseCode(code), code).toBe(true);
});

describe.each(courses)("%s", (code) => {
  it(`${code}: holds only the three known files`, () => {
    expect(readdirSync(join(ROOT, code)).filter((file) => !FILES.includes(file))).toEqual([]);
  });

  it(`${code}: the resource list is valid`, () => {
    const raw = read(code, "resources.json");
    expect(raw, "resources.json is missing").toBeDefined();
    const resources = parseResources(raw);
    expect(resources.course).toBe(code);
    // What parseResources returns is what the page shows: nothing in the file is dropped.
    expect(resources).toEqual(raw);
  });

  it(`${code}: the booklets are valid and belong together`, () => {
    const rawKnowledge = read(code, "knowledge.json");
    const rawExams = read(code, "exams.json");
    let knowledge: KnowledgeBooklet | null = null;
    let exams: ExamBooklet | null = null;
    if (rawKnowledge !== undefined) {
      knowledge = parseKnowledgeBooklet(rawKnowledge);
      expect(knowledge).toEqual(rawKnowledge);
    }
    if (rawExams !== undefined) {
      exams = parseExamBooklet(rawExams);
      expect(exams).toEqual(rawExams);
    }
    // A course has both booklets or neither.
    expect(knowledge === null, "one booklet is missing").toBe(exams === null);
    expect(crossCheck(code, knowledge, exams)).toEqual([]);
    // The suggested study time divides the hours of the course and nothing else.
    if (knowledge && exams?.available) {
      const hours = topicStatistics(knowledge, exams).reduce((sum, row) => sum + (row.hours ?? 0), 0);
      expect(hours, "the suggested hours add up to the course").toBe(knowledge.ects * HOURS_PER_ECTS);
    }
  });

  // A highlighter that is used on everything says nothing. The booklet of what to know
  // marks some things to know by heart, and neither booklet marks more than a quarter.
  it(`${code}: marks what to know by heart, and not too much of it`, () => {
    const rawKnowledge = read(code, "knowledge.json");
    const rawExams = read(code, "exams.json");
    if (rawKnowledge !== undefined) {
      const knowledge = parseKnowledgeBooklet(rawKnowledge);
      const found = marked([
        ...knowledge.topics.flatMap((topic) => [...topic.know, ...topic.do, ...topic.pitfalls]),
        ...knowledge.prerequisites,
        ...knowledge.studyAdvice,
      ]);
      expect(found.marks, "knowledge.json: marks").toBeGreaterThanOrEqual(5);
      expect(found.share, "knowledge.json: share of the text that is marked").toBeLessThanOrEqual(0.25);
    }
    if (rawExams !== undefined) {
      const exams = parseExamBooklet(rawExams);
      const found = marked([...exams.recurring, ...exams.trends, ...exams.strategy, ...exams.pitfalls]);
      expect(found.share, "exams.json: share of the text that is marked").toBeLessThanOrEqual(0.25);
    }
  });
});

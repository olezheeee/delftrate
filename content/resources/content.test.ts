// Checks every resource list and booklet in this folder. To check one course only:
//   npx vitest run content -t CSE21C
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  HOURS_PER_ECTS,
  crossCheck,
  isCourseCode,
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
});

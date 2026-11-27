// Draws both booklets of every course in content/resources, as the page does, and checks
// what comes out. To check one course only:  npx vitest run sketch/render -t CSE21C
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { markedParts, parseExamBooklet, parseKnowledgeBooklet } from "@/lib/resources";
import { SketchExam } from "./SketchExam";
import { SketchKnowledge } from "./SketchKnowledge";

// Outside Next.js there is no font loader and no router: a class name and a plain link do.
vi.mock("./font", () => ({ hand: { variable: "hand" } }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => <a href={href}>{children}</a>,
}));

const ROOT = join(import.meta.dirname, "../../../../../../content/resources");
const courses = readdirSync(ROOT).filter(
  (name) => statSync(join(ROOT, name)).isDirectory() && existsSync(join(ROOT, name, "knowledge.json")),
);

function load(code: string) {
  const read = (file: string) => JSON.parse(readFileSync(join(ROOT, code, file), "utf8"));
  return { knowledge: parseKnowledgeBooklet(read("knowledge.json")), exams: parseExamBooklet(read("exams.json")) };
}

function count(html: string, piece: string): number {
  return html.split(piece).length - 1;
}

function marksIn(lines: string[]): number {
  return lines.flatMap((line) => markedParts(line)).filter((part) => part.marked).length;
}

it("finds the courses with booklets", () => {
  expect(courses.length).toBeGreaterThan(0);
});

describe.each(courses)("%s", (code) => {
  const { knowledge, exams } = load(code);

  it(`${code}: draws the booklet of what to know`, () => {
    const html = renderToStaticMarkup(<SketchKnowledge knowledge={knowledge} exams={exams} />);
    expect(html).not.toMatch(/NaN|undefined|\[\[|\]\]/);
    // One circle diagram; a bar of lecture time per topic, and one of exam points with papers.
    expect(count(html, 'aria-label="Circle diagram')).toBe(1);
    expect(count(html, "of the lecture time&quot;") + count(html, 'of the lecture time"')).toBeGreaterThanOrEqual(
      knowledge.topics.length,
    );
    expect(count(html, "% of the exam points\"")).toBe(exams.available ? knowledge.topics.length : 0);
    // Every topic is there under its number, and the list of the diagram links to it.
    knowledge.topics.forEach((_, index) => {
      expect(html).toContain(`id="topic-${index + 1}"`);
      expect(html).toContain(`href="#topic-${index + 1}"`);
    });
    // What the file marks is what the page highlights: no more, no less.
    const lines = [
      ...knowledge.topics.flatMap((topic) => [...topic.know, ...topic.do, ...topic.pitfalls]),
      ...knowledge.prerequisites,
      ...knowledge.studyAdvice,
    ];
    expect(count(html, "<mark>")).toBe(marksIn(lines));
  });

  it(`${code}: draws the booklet of the exam`, () => {
    const html = renderToStaticMarkup(<SketchExam exams={exams} knowledge={knowledge} />);
    expect(html).not.toMatch(/NaN|undefined|Infinity|\[\[|\]\]/);
    // With past papers: the points per topic and per kind of question, each as a circle
    // and as bars, and the table of papers. Without: none of them.
    expect(count(html, 'aria-label="Circle diagram')).toBe(exams.available ? 2 : 0);
    expect(count(html, "% of the exam points\"")).toBe(exams.topicWeights.length + exams.questionTypes.length);
    expect(count(html, "<table")).toBe(exams.available ? 1 : 0);
    expect(count(html, 'role="rowheader"')).toBe(exams.basis.papers.length);
    expect(html).toContain(exams.available ? "the exam" : "the assessment");
    expect(count(html, "<mark>")).toBe(
      marksIn([...exams.recurring, ...exams.trends, ...exams.strategy, ...exams.pitfalls]),
    );
  });
});

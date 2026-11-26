// Study material of a course, shown in the course card as "Resources": the list of what
// the Lightspace archive holds for the course, and two booklets written for DelftRate.
//
// The data lives in content/resources/<CODE>/ as JSON (see the README there). This module
// says what those files must look like and checks them. No React, no database and no file
// access here, so it is tested on its own; resources-data.ts does the reading.

export class ContentError extends Error {}

// ---------------------------------------------------------------------------
// The resource list (resources.json), written by scripts/import_lightspace.py.
// ---------------------------------------------------------------------------

export const RESOURCE_KINDS = ["lectures", "exams", "solutions", "notes", "textbooks", "links"] as const;
export type ResourceKind = (typeof RESOURCE_KINDS)[number];

export type ResourceItem = {
  title: string;
  // Missing for textbooks: a book is listed by its title only.
  url?: string;
  // Where it sits in the archive, for example "Endterms" or "From IDM / Resits".
  section?: string;
  size?: string;
};

export type ResourceGroup = { kind: ResourceKind; items: ResourceItem[] };

export type CourseResources = {
  course: string;
  source: { name: string; title: string; url: string; retrieved: string };
  groups: ResourceGroup[];
};

// ---------------------------------------------------------------------------
// The knowledge booklet (knowledge.json): what a student should know.
// ---------------------------------------------------------------------------

export const IMPORTANCE = ["essential", "important", "useful"] as const;
export type Importance = (typeof IMPORTANCE)[number];

export type KnowledgeTopic = {
  name: string;
  // The lectures that cover it, as the archive names them ("Lecture 2", "Lectures 6 to 8").
  lectures: string[];
  // Share of the lecture time, in whole percent. The topics of a booklet add up to 100.
  timeShare: number;
  importance: Importance;
  // What to know, what to be able to do, and where students go wrong.
  know: string[];
  do: string[];
  pitfalls: string[];
};

export type KnowledgeBooklet = {
  course: string;
  title: string;
  ects: number;
  summary: string;
  basis: {
    // How many lectures the booklet was made from.
    lectures: number;
    // Which material it was made from, in one or two sentences.
    description: string;
    // What may differ in the course as it is taught now. Null when nothing is known.
    caveat: string | null;
  };
  topics: KnowledgeTopic[];
  prerequisites: string[];
  // Labs, projects and assignments. Null when the course has none.
  practical: string | null;
  studyAdvice: string[];
};

// ---------------------------------------------------------------------------
// The exam booklet (exams.json): what the past papers show.
// ---------------------------------------------------------------------------

export const PAPER_KINDS = ["endterm", "midterm", "resit", "practice", "other"] as const;
export type PaperKind = (typeof PAPER_KINDS)[number];

export type ExamPaper = {
  // As the archive names it: "Endterm 2025".
  name: string;
  // The year in the name. The archive names a paper by its academic year, so the midterm of
  // December 2024 is "Midterm 2025", year 2025. Null for a paper without a year.
  year: number | null;
  kind: PaperKind;
  questions: number | null;
  points: number | null;
  minutes: number | null;
};

export type ExamBooklet = {
  course: string;
  title: string;
  // False when the archive holds no past papers for the course. The booklet then describes
  // how the course is assessed and has no numbers.
  available: boolean;
  summary: string;
  basis: { papers: ExamPaper[]; note: string | null };
  format: {
    mode: string;
    duration: string | null;
    structure: string;
    grading: string | null;
    aids: string | null;
  };
  // Share of the points per topic over the papers, in whole percent, adding up to 100.
  // `topic` is the name of a topic in the knowledge booklet, or "Other".
  topicWeights: { topic: string; share: number; appearsIn: number; asks: string }[];
  // Share of the points per kind of question, in whole percent, adding up to 100.
  questionTypes: { type: string; share: number; description: string }[];
  recurring: string[];
  trends: string[];
  strategy: string[];
  pitfalls: string[];
};

export const OTHER_TOPIC = "Other";

// ---------------------------------------------------------------------------
// Checking. Every function throws a ContentError that names the field.
// ---------------------------------------------------------------------------

const COURSE_CODE = /^[A-Z0-9][A-Z0-9-]{1,19}$/;

export function isCourseCode(value: string): boolean {
  return COURSE_CODE.test(value);
}

function fail(path: string, message: string): never {
  throw new ContentError(`${path} ${message}`);
}

function record(value: unknown, path: string, allowed: readonly string[]): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) fail(path, "must be an object");
  const found = value as Record<string, unknown>;
  for (const key of Object.keys(found)) {
    if (!allowed.includes(key)) fail(`${path}.${key}`, "is not a known field");
  }
  return found;
}

// Booklets are shown as plain text: no Markdown, no LaTeX, no links.
const MARKUP = /\*\*|`|\$\$|\\\(|\\frac|https?:\/\//;

function text(value: unknown, path: string, max: number, plain = true): string {
  if (typeof value !== "string") fail(path, "must be text");
  const trimmed = value.trim();
  if (trimmed === "") fail(path, "must not be empty");
  if (trimmed !== value) fail(path, "must not start or end with a space");
  if (value.length > max) fail(path, `must be at most ${max} characters (it has ${value.length})`);
  if (plain && MARKUP.test(value)) fail(path, "must be plain text: no Markdown, LaTeX or links");
  return value;
}

function textOrNull(value: unknown, path: string, max: number): string | null {
  return value === null ? null : text(value, path, max);
}

function whole(value: unknown, path: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `must be a whole number from ${min} to ${max}`);
  }
  return value;
}

// The points of a paper: a whole number or a half. Both ends exist: a midterm worth 12.5
// points, and a resit worth 8000.
function pointsOrNull(value: unknown, path: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value * 2) || value < 1 || value > 10000) {
    throw new ContentError(`${path} must be a number of points from 1 to 10000, whole or a half, or null`);
  }
  return value;
}

function wholeOrNull(value: unknown, path: string, min: number, max: number): number | null {
  return value === null ? null : whole(value, path, min, max);
}

function oneOf<T extends string>(value: unknown, path: string, options: readonly T[]): T {
  if (typeof value !== "string" || !options.includes(value as T)) {
    fail(path, `must be one of: ${options.join(", ")}`);
  }
  return value as T;
}

function list<T>(
  value: unknown,
  path: string,
  min: number,
  max: number,
  each: (item: unknown, path: string) => T,
): T[] {
  if (!Array.isArray(value)) fail(path, "must be a list");
  if (value.length < min || value.length > max) {
    fail(path, `must have ${min === max ? min : `${min} to ${max}`} entries (it has ${value.length})`);
  }
  return value.map((item, index) => each(item, `${path}[${index}]`));
}

function lines(value: unknown, path: string, min: number, max: number, length = 260): string[] {
  return list(value, path, min, max, (item, at) => text(item, at, length));
}

function unique(names: string[], path: string): void {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) fail(path, `lists "${name}" twice`);
    seen.add(key);
  }
}

function addsUpTo100(shares: number[], path: string): void {
  const sum = shares.reduce((a, b) => a + b, 0);
  if (sum !== 100) fail(path, `must add up to 100 (they add up to ${sum})`);
}

function courseCode(value: unknown, path: string): string {
  if (typeof value !== "string" || !isCourseCode(value)) fail(path, "must be a course code such as CSE21C");
  return value;
}

// A day that exists, written as 2026-11-26. "2026-02-31" has the shape of a date and is
// none: the page would show another day for it, or fail to show the list at all.
function isCalendarDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseResources(value: unknown): CourseResources {
  const root = record(value, "resources", ["course", "source", "groups"]);
  const source = record(root.source, "source", ["name", "title", "url", "retrieved"]);
  const sourceUrl = text(source.url, "source.url", 300, false);
  if (!/^https:\/\//.test(sourceUrl)) fail("source.url", "must be an https address");
  const retrieved = text(source.retrieved, "source.retrieved", 10, false);
  if (!isCalendarDay(retrieved)) fail("source.retrieved", "must be a date such as 2026-11-26");

  const groups = list(root.groups, "groups", 1, RESOURCE_KINDS.length, (raw, path): ResourceGroup => {
    const group = record(raw, path, ["kind", "items"]);
    const kind = oneOf(group.kind, `${path}.kind`, RESOURCE_KINDS);
    const items = list(group.items, `${path}.items`, 1, 200, (rawItem, at): ResourceItem => {
      const item = record(rawItem, at, ["title", "url", "section", "size"]);
      const result: ResourceItem = { title: text(item.title, `${at}.title`, 200, false) };
      if (item.url !== undefined) {
        const url = text(item.url, `${at}.url`, 600, false);
        // Only real web addresses: the page puts these in a link.
        if (!/^https:\/\/[^\s"<>]+$/.test(url)) fail(`${at}.url`, "must be an https address");
        result.url = url;
      }
      if (kind === "textbooks" && result.url) fail(`${at}.url`, "is not allowed: a textbook is listed by title only");
      if (kind !== "textbooks" && !result.url) fail(`${at}.url`, "is missing");
      if (item.section !== undefined) result.section = text(item.section, `${at}.section`, 120, false);
      if (item.size !== undefined) result.size = text(item.size, `${at}.size`, 12, false);
      return result;
    });
    return { kind, items };
  });
  unique(groups.map((group) => group.kind), "groups");

  return {
    course: courseCode(root.course, "course"),
    source: {
      name: text(source.name, "source.name", 60, false),
      title: text(source.title, "source.title", 160, false),
      url: sourceUrl,
      retrieved,
    },
    groups,
  };
}

export function parseKnowledgeBooklet(value: unknown): KnowledgeBooklet {
  const root = record(value, "knowledge", [
    "course", "title", "ects", "summary", "basis", "topics", "prerequisites", "practical", "studyAdvice",
  ]);
  const basis = record(root.basis, "basis", ["lectures", "description", "caveat"]);

  const topics = list(root.topics, "topics", 3, 12, (raw, path): KnowledgeTopic => {
    const topic = record(raw, path, ["name", "lectures", "timeShare", "importance", "know", "do", "pitfalls"]);
    const name = text(topic.name, `${path}.name`, 60);
    if (name === OTHER_TOPIC) fail(`${path}.name`, `must not be "${OTHER_TOPIC}": name what the topic is`);
    return {
      name,
      lectures: lines(topic.lectures, `${path}.lectures`, 0, 12, 90),
      timeShare: whole(topic.timeShare, `${path}.timeShare`, 1, 100),
      importance: oneOf(topic.importance, `${path}.importance`, IMPORTANCE),
      know: lines(topic.know, `${path}.know`, 3, 8),
      do: lines(topic.do, `${path}.do`, 1, 6),
      pitfalls: lines(topic.pitfalls, `${path}.pitfalls`, 0, 4),
    };
  });
  unique(topics.map((topic) => topic.name), "topics");
  addsUpTo100(topics.map((topic) => topic.timeShare), "topics: the timeShare values");

  return {
    course: courseCode(root.course, "course"),
    title: text(root.title, "title", 120),
    ects: whole(root.ects, "ects", 1, 30),
    summary: text(root.summary, "summary", 700),
    basis: {
      lectures: whole(basis.lectures, "basis.lectures", 0, 80),
      description: text(basis.description, "basis.description", 400),
      caveat: textOrNull(basis.caveat, "basis.caveat", 500),
    },
    topics,
    prerequisites: lines(root.prerequisites, "prerequisites", 0, 6),
    practical: textOrNull(root.practical, "practical", 700),
    studyAdvice: lines(root.studyAdvice, "studyAdvice", 3, 7, 320),
  };
}

export function parseExamBooklet(value: unknown): ExamBooklet {
  const root = record(value, "exams", [
    "course", "title", "available", "summary", "basis", "format", "topicWeights", "questionTypes",
    "recurring", "trends", "strategy", "pitfalls",
  ]);
  if (typeof root.available !== "boolean") fail("available", "must be true or false");
  const available = root.available;
  const basis = record(root.basis, "basis", ["papers", "note"]);
  const format = record(root.format, "format", ["mode", "duration", "structure", "grading", "aids"]);

  const papers = list(basis.papers, "basis.papers", available ? 1 : 0, available ? 40 : 0, (raw, path): ExamPaper => {
    const paper = record(raw, path, ["name", "year", "kind", "questions", "points", "minutes"]);
    const name = text(paper.name, `${path}.name`, 80);
    const year = wholeOrNull(paper.year, `${path}.year`, 2000, 2100);
    // One year per paper: the one in its name, so the list and the booklet agree.
    const named = name.match(/\b20\d\d\b/g);
    if (named && named.length === 1 && Number(named[0]) !== year) {
      fail(`${path}.year`, `must be ${named[0]}, the year in the name "${name}"`);
    }
    return {
      name,
      year,
      kind: oneOf(paper.kind, `${path}.kind`, PAPER_KINDS),
      questions: wholeOrNull(paper.questions, `${path}.questions`, 1, 300),
      points: pointsOrNull(paper.points, `${path}.points`),
      minutes: wholeOrNull(paper.minutes, `${path}.minutes`, 10, 600),
    };
  });
  unique(papers.map((paper) => paper.name), "basis.papers");

  // Without past papers there is nothing to count, so the lists of numbers stay empty.
  const topicWeights = list(root.topicWeights, "topicWeights", available ? 2 : 0, available ? 13 : 0, (raw, path) => {
    const weight = record(raw, path, ["topic", "share", "appearsIn", "asks"]);
    return {
      topic: text(weight.topic, `${path}.topic`, 60),
      share: whole(weight.share, `${path}.share`, 1, 100),
      appearsIn: whole(weight.appearsIn, `${path}.appearsIn`, 1, papers.length),
      asks: text(weight.asks, `${path}.asks`, 320),
    };
  });
  const questionTypes = list(root.questionTypes, "questionTypes", available ? 2 : 0, available ? 8 : 0, (raw, path) => {
    const type = record(raw, path, ["type", "share", "description"]);
    return {
      type: text(type.type, `${path}.type`, 60),
      share: whole(type.share, `${path}.share`, 1, 100),
      description: text(type.description, `${path}.description`, 320),
    };
  });
  if (available) {
    unique(topicWeights.map((weight) => weight.topic), "topicWeights");
    unique(questionTypes.map((type) => type.type), "questionTypes");
    addsUpTo100(topicWeights.map((weight) => weight.share), "topicWeights: the share values");
    addsUpTo100(questionTypes.map((type) => type.share), "questionTypes: the share values");
  }

  return {
    course: courseCode(root.course, "course"),
    title: text(root.title, "title", 120),
    available,
    summary: text(root.summary, "summary", 700),
    basis: { papers, note: textOrNull(basis.note, "basis.note", 500) },
    format: {
      mode: text(format.mode, "format.mode", 200),
      duration: textOrNull(format.duration, "format.duration", 120),
      structure: text(format.structure, "format.structure", 500),
      grading: textOrNull(format.grading, "format.grading", 500),
      aids: textOrNull(format.aids, "format.aids", 300),
    },
    topicWeights,
    questionTypes,
    recurring: lines(root.recurring, "recurring", available ? 3 : 0, 8, 320),
    trends: lines(root.trends, "trends", 0, 5, 320),
    strategy: lines(root.strategy, "strategy", 3, 8, 320),
    pitfalls: lines(root.pitfalls, "pitfalls", available ? 2 : 0, 6, 320),
  };
}

// The two booklets of one course belong together: the exam booklet weighs the topics of
// the knowledge booklet. Returns the problems found, in words.
export function crossCheck(code: string, knowledge: KnowledgeBooklet | null, exams: ExamBooklet | null): string[] {
  const problems: string[] = [];
  for (const [file, booklet] of [["knowledge.json", knowledge], ["exams.json", exams]] as const) {
    if (booklet && booklet.course !== code) problems.push(`${file}: course is ${booklet.course}, the folder is ${code}`);
  }
  if (knowledge && exams) {
    if (knowledge.title !== exams.title) problems.push("the two booklets give the course a different title");
    const names = new Set(knowledge.topics.map((topic) => topic.name));
    for (const weight of exams.topicWeights) {
      if (weight.topic !== OTHER_TOPIC && !names.has(weight.topic)) {
        problems.push(`exams.json: topicWeights names "${weight.topic}", which is not a topic of knowledge.json`);
      }
    }
  }
  return problems;
}

// ---------------------------------------------------------------------------
// Numbers the pages show, derived from the booklets.
// ---------------------------------------------------------------------------

// One EC stands for 28 hours of study at TU Delft.
// Practice sets are not past exams. A booklet that counted nothing else says "practice
// papers" wherever it would say "past papers".
export function papersNoun(exams: ExamBooklet, count = exams.basis.papers.length): string {
  const practice = exams.basis.papers.length > 0 && exams.basis.papers.every((paper) => paper.kind === "practice");
  return `${practice ? "practice" : "past"} ${count === 1 ? "paper" : "papers"}`;
}

export const HOURS_PER_ECTS = 28;

export type TopicStatistic = {
  name: string;
  importance: Importance;
  timeShare: number;
  // Share of the exam points. Null when there are no past papers to count.
  examShare: number | null;
  // A suggested number of study hours: the course's hours divided by the mean of the time
  // share and the exam share. Null without past papers: lecture time alone says how the
  // taught sessions are divided, not where the hours of the course go (in a project course
  // nearly all of them go into the project).
  hours: number | null;
};

export function topicStatistics(knowledge: KnowledgeBooklet, exams: ExamBooklet | null): TopicStatistic[] {
  const counted = exams?.available ? exams : null;
  const examShares = knowledge.topics.map((topic) =>
    counted ? (counted.topicWeights.find((weight) => weight.topic === topic.name)?.share ?? 0) : null,
  );
  // The hours of the course are divided over the topics by the mean of the two shares.
  // Exam points that belong to no topic ("Other") are left out of that division: the
  // shares of the topics are taken of what is left, so that the hours add up to the course.
  const named = examShares.reduce<number>((sum, share) => sum + (share ?? 0), 0);
  const hours = wholeParts(
    knowledge.topics.map((topic, index) => {
      const examPart = named > 0 ? (examShares[index] ?? 0) / named : topic.timeShare / 100;
      return (topic.timeShare / 100 + examPart) / 2;
    }),
    knowledge.ects * HOURS_PER_ECTS,
  );
  return knowledge.topics.map((topic, index) => ({
    name: topic.name,
    importance: topic.importance,
    timeShare: topic.timeShare,
    examShare: examShares[index],
    hours: examShares[index] === null ? null : hours[index],
  }));
}

// Divides a whole number over parts (fractions that add up to 1) in whole numbers that add
// up to it again: every part is rounded down, and what is left goes one by one to the
// parts that lost most by that.
function wholeParts(parts: number[], total: number): number[] {
  const exact = parts.map((part) => part * total);
  const whole = exact.map((value) => Math.floor(value + 1e-9));
  const order = exact
    .map((value, index) => ({ index, lost: value - whole[index] }))
    .sort((a, b) => b.lost - a.lost || a.index - b.index);
  let left = total - whole.reduce((sum, value) => sum + value, 0);
  for (const { index } of order) {
    if (left <= 0) break;
    whole[index] += 1;
    left -= 1;
  }
  return whole;
}

import { describe, expect, it } from "vitest";
import {
  ContentError,
  crossCheck,
  isCourseCode,
  parseExamBooklet,
  parseKnowledgeBooklet,
  papersNoun,
  parseResources,
  topicStatistics,
} from "./resources";

// A valid file of each kind. Every test changes one thing in a copy.
const RESOURCES = {
  course: "CSE21C",
  source: { name: "Lightspace", title: "Operating Systems", url: "https://example.org/os", retrieved: "2026-11-26" },
  groups: [
    { kind: "lectures", items: [{ title: "Lecture 1", url: "https://example.org/os/1.pdf", size: "2 MB" }] },
    { kind: "exams", items: [{ title: "Endterm 2024", url: "https://example.org/os/e.pdf", section: "Endterms" }] },
    { kind: "textbooks", items: [{ title: "A Book" }] },
  ],
};

function topic(name: string, timeShare: number) {
  return {
    name,
    lectures: ["Lecture 1"],
    timeShare,
    importance: "essential",
    know: ["One thing", "Another thing", "A third thing"],
    do: ["Trace it"],
    pitfalls: [],
  };
}

const KNOWLEDGE = {
  course: "CSE21C",
  title: "Operating Systems",
  ects: 5,
  summary: "What an operating system does.",
  basis: { lectures: 12, description: "The lecture slides of 2024.", caveat: null },
  topics: [topic("Scheduling", 50), topic("Memory", 30), topic("File systems", 20)],
  prerequisites: [],
  practical: null,
  studyAdvice: ["Start early", "Do the labs", "Practise past papers"],
};

const EXAMS = {
  course: "CSE21C",
  title: "Operating Systems",
  available: true,
  summary: "A closed-book exam.",
  basis: {
    papers: [
      { name: "Endterm 2024", year: 2024, kind: "endterm", questions: 9, points: 90, minutes: null },
      { name: "Resit 2024", year: 2024, kind: "resit", questions: 9, points: 90, minutes: 180 },
    ],
    note: null,
  },
  format: { mode: "Digital, closed book", duration: null, structure: "Nine problems", grading: null, aids: null },
  topicWeights: [
    { topic: "Scheduling", share: 60, appearsIn: 2, asks: "Trace a schedule." },
    { topic: "Memory", share: 30, appearsIn: 2, asks: "Translate addresses." },
    { topic: "Other", share: 10, appearsIn: 1, asks: "Definitions." },
  ],
  questionTypes: [
    { type: "Calculation", share: 70, description: "Work something out." },
    { type: "Explanation", share: 30, description: "Explain a concept." },
  ],
  recurring: ["A scheduling trace", "A page table", "Definitions"],
  trends: [],
  strategy: ["Practise traces", "Time yourself", "Read the question"],
  pitfalls: ["Units", "Off by one"],
};

// A deep copy with one value replaced: change(KNOWLEDGE, "topics.0.timeShare", 40).
function change<T>(value: T, path: string, to: unknown): T {
  const copy = structuredClone(value) as Record<string, unknown>;
  const keys = path.split(".");
  let at: Record<string, unknown> = copy;
  for (const key of keys.slice(0, -1)) at = at[key] as Record<string, unknown>;
  const last = keys[keys.length - 1];
  if (to === undefined) delete at[last];
  else at[last] = to;
  return copy as T;
}

describe("a course code", () => {
  it("is capitals, digits and hyphens only, so it is safe in a file path", () => {
    for (const code of ["CSE21C", "AE1110-I", "WI1421LR"]) expect(isCourseCode(code), code).toBe(true);
    for (const code of ["cse21c", "", "A", "../CSE21C", "CSE21C/..", "CSE 21C", "CSE21C.json", "-CSE"]) {
      expect(isCourseCode(code), code).toBe(false);
    }
  });
});

describe("the resource list", () => {
  it("accepts a valid file and returns it unchanged", () => {
    expect(parseResources(RESOURCES)).toEqual(RESOURCES);
  });

  it("lists a textbook by title only, and everything else with a link", () => {
    expect(() => parseResources(change(RESOURCES, "groups.2.items.0.url", "https://example.org/book.pdf"))).toThrow(
      /textbook is listed by title only/,
    );
    expect(() => parseResources(change(RESOURCES, "groups.0.items.0.url", undefined))).toThrow(/url is missing/);
  });

  it("only takes https addresses, because the page puts them in a link", () => {
    for (const url of ["javascript:alert(1)", "http://example.org/a", "//example.org/a", "https://exa mple.org", ""]) {
      expect(() => parseResources(change(RESOURCES, "groups.0.items.0.url", url)), url).toThrow(ContentError);
    }
  });

  it("refuses an unknown kind, a repeated group, an empty group and an unknown field", () => {
    expect(() => parseResources(change(RESOURCES, "groups.0.kind", "videos"))).toThrow(/must be one of/);
    // The shape of a date is not enough: the page shows the day, and these are none.
    for (const day of ["2026-13-01", "2026-02-31", "2026-00-10", "26-11-2026"]) {
      expect(() => parseResources(change(RESOURCES, "source.retrieved", day)), day).toThrow(/source.retrieved must be a date/);
    }
    expect(() => parseResources(change(RESOURCES, "groups.1.kind", "lectures"))).toThrow(/twice/);
    expect(() => parseResources(change(RESOURCES, "groups.0.items", []))).toThrow(/entries/);
    expect(() => parseResources(change(RESOURCES, "groups.0.items.0.note", "x"))).toThrow(/not a known field/);
  });
});

describe("the knowledge booklet", () => {
  it("accepts a valid file and returns it unchanged", () => {
    expect(parseKnowledgeBooklet(KNOWLEDGE)).toEqual(KNOWLEDGE);
  });

  it("wants the time shares to add up to 100", () => {
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "topics.0.timeShare", 40))).toThrow(
      /add up to 100 \(they add up to 90\)/,
    );
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "topics.0.timeShare", 49.5))).toThrow(/whole number/);
  });

  it("refuses two topics with one name, and a topic called Other", () => {
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "topics.1.name", "scheduling"))).toThrow(/twice/);
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "topics.1.name", "Other"))).toThrow(/name what the topic is/);
  });

  it("refuses Markdown, LaTeX and links: the page shows plain text", () => {
    for (const text of ["**bold**", "use `fork()`", "$$x^2$$", "see https://example.org", "\\frac{1}{2}"]) {
      expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "summary", text)), text).toThrow(/plain text/);
    }
  });

  it("refuses text that is too long, empty or padded, and names the field", () => {
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "summary", "x".repeat(701)))).toThrow(
      /^summary must be at most 700 characters \(it has 701\)$/,
    );
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "topics.2.know.1", " "))).toThrow(/^topics\[2\]\.know\[1\]/);
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "title", "Operating Systems "))).toThrow(/space/);
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "topics.0.know", ["One"]))).toThrow(/3 to 8 entries/);
  });

  it("refuses a missing or an unknown field", () => {
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "ects", undefined))).toThrow(/^ects must be a whole number/);
    expect(() => parseKnowledgeBooklet(change(KNOWLEDGE, "author", "x"))).toThrow(/knowledge\.author is not a known field/);
  });
});

describe("the exam booklet", () => {
  it("accepts a valid file and returns it unchanged", () => {
    expect(parseExamBooklet(EXAMS)).toEqual(EXAMS);
  });

  it("wants both sets of shares to add up to 100", () => {
    expect(() => parseExamBooklet(change(EXAMS, "topicWeights.0.share", 50))).toThrow(/topicWeights.*add up to 100/);
    expect(() => parseExamBooklet(change(EXAMS, "questionTypes.0.share", 60))).toThrow(/questionTypes.*add up to 100/);
  });

  it("cannot have a topic in more papers than were counted", () => {
    expect(() => parseExamBooklet(change(EXAMS, "topicWeights.0.appearsIn", 3))).toThrow(/whole number from 1 to 2/);
  });

  it("takes whole and half points for a paper, nothing finer", () => {
    expect(parseExamBooklet(change(EXAMS, "basis.papers.0.points", 12.5)).basis.papers[0].points).toBe(12.5);
    for (const points of [12.25, 0, -3, "90"]) {
      expect(() => parseExamBooklet(change(EXAMS, "basis.papers.0.points", points)), String(points)).toThrow(
        /whole or a half/,
      );
    }
  });

  it("refuses an unknown kind of paper, an impossible year and a year that is not the one in the name", () => {
    expect(() => parseExamBooklet(change(EXAMS, "basis.papers.0.kind", "final"))).toThrow(/must be one of/);
    expect(() => parseExamBooklet(change(EXAMS, "basis.papers.0.year", 24))).toThrow(/2000 to 2100/);
    // "Endterm 2024" sat in another calendar year is still the 2024 paper.
    expect(() => parseExamBooklet(change(EXAMS, "basis.papers.0.year", 2023))).toThrow(/must be 2024, the year in the name/);
    expect(() => parseExamBooklet(change(EXAMS, "basis.papers.0.year", null))).toThrow(/must be 2024/);
    // A paper without a year in its name may have none.
    const unnamed = change(change(EXAMS, "basis.papers.0.name", "Practice Exam 1"), "basis.papers.0.year", null);
    expect(parseExamBooklet(unnamed).basis.papers[0].year).toBeNull();
  });

  it("has no numbers when there are no past papers", () => {
    const none = {
      ...EXAMS,
      available: false,
      basis: { papers: [], note: null },
      topicWeights: [],
      questionTypes: [],
      recurring: [],
      pitfalls: [],
    };
    expect(parseExamBooklet(none)).toEqual(none);
    // Numbers without papers to count them from are refused.
    expect(() => parseExamBooklet({ ...none, topicWeights: EXAMS.topicWeights })).toThrow(/topicWeights must have 0 entries/);
    expect(() => parseExamBooklet({ ...none, basis: EXAMS.basis })).toThrow(/basis\.papers must have 0 entries/);
    // And a booklet that says it has papers must list them.
    expect(() => parseExamBooklet({ ...none, available: true })).toThrow(/basis\.papers must have 1 to 40 entries/);
  });
});

describe("what the papers are called", () => {
  it("is past papers, unless only practice sets were counted", () => {
    expect(papersNoun(parseExamBooklet(EXAMS))).toBe("past papers");
    expect(papersNoun(parseExamBooklet(EXAMS), 1)).toBe("past paper");
    const practice = parseExamBooklet(
      change(change(EXAMS, "basis.papers.0.kind", "practice"), "basis.papers.1.kind", "practice"),
    );
    expect(papersNoun(practice)).toBe("practice papers");
    // One real paper among them is enough to call them past papers.
    expect(papersNoun(parseExamBooklet(change(EXAMS, "basis.papers.0.kind", "practice")))).toBe("past papers");
  });
});

describe("the two booklets of a course", () => {
  const knowledge = parseKnowledgeBooklet(KNOWLEDGE);
  const exams = parseExamBooklet(EXAMS);

  it("belong together when the exam weighs the topics of the knowledge booklet", () => {
    expect(crossCheck("CSE21C", knowledge, exams)).toEqual([]);
    expect(crossCheck("CSE21C", null, null)).toEqual([]);
  });

  it("are refused under another course, with different titles, or with a topic only the exam knows", () => {
    expect(crossCheck("CSE21B", knowledge, exams)).toHaveLength(2);
    expect(crossCheck("CSE21C", knowledge, { ...exams, title: "OS" })).toEqual([
      "the two booklets give the course a different title",
    ]);
    const stray = parseExamBooklet(change(EXAMS, "topicWeights.1.topic", "Virtual memory"));
    expect(crossCheck("CSE21C", knowledge, stray)).toEqual([
      'exams.json: topicWeights names "Virtual memory", which is not a topic of knowledge.json',
    ]);
  });
});

describe("the statistics of a topic", () => {
  const knowledge = parseKnowledgeBooklet(KNOWLEDGE);

  it("puts the exam share next to the lecture time and suggests hours from both", () => {
    // 5 EC is 140 hours. 10% of the exam points are under "Other" and belong to no topic,
    // so Scheduling has 60 of the 90 that do: (50% + 60/90) / 2 of 140 = 81.7 hours.
    const statistics = topicStatistics(knowledge, parseExamBooklet(EXAMS));
    expect(statistics).toEqual([
      { name: "Scheduling", importance: "essential", timeShare: 50, examShare: 60, hours: 82 },
      { name: "Memory", importance: "essential", timeShare: 30, examShare: 30, hours: 44 },
      // Not examined in the papers counted: 0, not unknown.
      { name: "File systems", importance: "essential", timeShare: 20, examShare: 0, hours: 14 },
    ]);
    // In whole hours that add up to the course again.
    expect(statistics.reduce((sum, row) => sum + (row.hours ?? 0), 0)).toBe(140);
  });

  it("divides the hours by lecture time alone when no exam point falls in a topic of the booklet", () => {
    // The checks on the files do not let this through; the hours must still be numbers.
    const exams = parseExamBooklet(EXAMS);
    const other = { ...exams, topicWeights: [{ ...exams.topicWeights[2], share: 100 }] };
    expect(topicStatistics(knowledge, other).map((row) => row.hours)).toEqual([70, 42, 28]);
  });

  it("suggests no hours when there are no past papers to weigh the lecture time against", () => {
    const none = parseExamBooklet({
      ...EXAMS,
      available: false,
      basis: { papers: [], note: null },
      topicWeights: [],
      questionTypes: [],
      recurring: [],
    });
    for (const exams of [none, null]) {
      expect(topicStatistics(knowledge, exams).map((row) => [row.examShare, row.hours])).toEqual([
        [null, null],
        [null, null],
        [null, null],
      ]);
    }
  });
});

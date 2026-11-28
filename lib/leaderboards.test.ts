import { describe, expect, it } from "vitest";
import type { CourseListEntry } from "./course-list";
import { buildBoards, shareText } from "./leaderboards";

type Prof = CourseListEntry["sheet"]["professors"][number];

function prof(id: string, name: string, approach: number | null, teach: number | null): Prof {
  return {
    id,
    name,
    votes: 10,
    averages: approach === null ? null : { engagement: 5, understanding: 5, approachability: approach },
    teach,
    combined: null,
  };
}

function course(
  code: string,
  o: {
    name?: string;
    programme?: string;
    year?: number;
    load?: number | null;
    exam?: number | null;
    interest?: number | null;
    professors?: Prof[];
  } = {},
): CourseListEntry {
  const programme = o.programme ?? "AE";
  const exam = o.exam ?? null;
  return {
    code,
    name: o.name ?? `Course ${code}`,
    programme,
    programmeName: programme === "AE" ? "Aerospace Engineering" : "Computer Science",
    year: o.year ?? 1,
    quarters: [1],
    sheet: {
      subject: {
        votes: 20,
        averages: exam === null ? null : { difficulty: 5, exam_level: exam, interest: o.interest ?? 5 },
        load: o.load ?? null,
      },
      professors: o.professors ?? [],
      startProfessorId: null,
    },
    professor: null,
    score: null,
    verdict: null,
    votes: 20,
  } as CourseListEntry;
}

const board = (entries: CourseListEntry[], id: string) => buildBoards(entries).find((b) => b.id === id)!;

describe("buildBoards", () => {
  it("returns the six boards in order", () => {
    const boards = buildBoards([]);
    expect(boards.map((b) => b.id)).toEqual([
      "hardest-subjects", "best-professors", "toughest-exams", "most-interesting", "most-approachable", "hardest-years",
    ]);
    expect(boards.map((b) => b.size)).toEqual([5, 5, 3, 3, 3, 3]);
    expect(boards.map((b) => b.big)).toEqual([true, true, false, false, false, false]);
    expect(boards[0].colour).toBe("#ff9d8a");
    expect(boards[2].colour).toBeUndefined();
    expect(boards.every((b) => b.rows.length === 0)).toBe(true);
  });

  it("ranks hardest subjects by load, leaves out null, and links to the course", () => {
    const rows = board(
      [course("A/1", { load: 6, name: "A", year: 2 }), course("B", { load: 8 }), course("C", { load: null })],
      "hardest-subjects",
    ).rows;
    expect(rows.map((r) => r.title)).toEqual(["Course B", "A"]);
    expect(rows[0]).toMatchObject({ rank: 1, value: 8, subtitle: "AE · Y1", href: "/courses/B" });
    expect(rows[1].href).toBe("/courses/A%2F1");
    expect(rows[1].subtitle).toBe("AE · Y2");
  });

  it("lists a professor once per course", () => {
    const p = prof("p1", "Prof One", 7, 8);
    const rows = board(
      [course("A", { name: "Alpha", professors: [p, prof("p2", "Hidden-less", 5, null)] }), course("B", { name: "Beta", professors: [p] })],
      "best-professors",
    ).rows;
    expect(rows.map((r) => [r.title, r.subtitle])).toEqual([
      ["Prof One", "AE · Alpha"],
      ["Prof One", "AE · Beta"],
    ]);
  });

  it("picks exam level, interest and approachability", () => {
    const entries = [
      course("A", { exam: 9, interest: 3, professors: [prof("p", "P", 6, 6)] }),
      course("B", { exam: 4, interest: 8, professors: [prof("q", "Q", null, null)] }),
    ];
    expect(board(entries, "toughest-exams").rows.map((r) => r.value)).toEqual([9, 4]);
    expect(board(entries, "most-interesting").rows.map((r) => r.value)).toEqual([8, 3]);
    const approachable = board(entries, "most-approachable").rows;
    expect(approachable).toHaveLength(1);
    expect(approachable[0]).toMatchObject({ title: "P", subtitle: "Course A", value: 6 });
  });

  it("cuts to 5 and 3", () => {
    const entries = Array.from({ length: 8 }, (_, i) => course(`C${i}`, { load: i + 1, exam: i + 1, interest: i + 1 }));
    expect(board(entries, "hardest-subjects").rows).toHaveLength(5);
    expect(board(entries, "toughest-exams").rows).toHaveLength(3);
    expect(board(entries, "toughest-exams").rows.map((r) => r.rank)).toEqual([1, 2, 3]);
  });

  it("breaks ties by title, then href, whatever the input order", () => {
    const a = course("X2", { name: "Same", load: 5 });
    const b = course("X1", { name: "Same", load: 5 });
    const c = course("Y", { name: "Alpha", load: 5 });
    const one = board([a, b, c], "hardest-subjects").rows.map((r) => r.href);
    const two = board([c, b, a], "hardest-subjects").rows.map((r) => r.href);
    expect(one).toEqual(["/courses/Y", "/courses/X1", "/courses/X2"]);
    expect(two).toEqual(one);
  });

  it("averages the load per programme and year", () => {
    const rows = board(
      [
        course("A", { load: 6, year: 1 }),
        course("B", { load: 8, year: 1 }),
        course("C", { load: null, year: 1 }),
        course("D", { load: 5, year: 2, programme: "CS" }),
        course("E", { load: null, year: 3 }),
      ],
      "hardest-years",
    ).rows;
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      title: "Aerospace Engineering, year 1",
      subtitle: "AE · 2 courses rated",
      value: 7,
      href: "/?programme=AE&year=1",
    });
    expect(rows[1]).toMatchObject({ subtitle: "CS · 1 course rated", value: 5, href: "/?programme=CS&year=2" });
  });
});

describe("ties", () => {
  it("treats values that differ only by floating point noise as a tie, broken by title", () => {
    // (7.7 + 7.9) / 2 is 7.800000000000001 in JavaScript; both show as 7.8.
    const rows = board(
      [course("A", { name: "Zeta", load: (7.7 + 7.9) / 2 }), course("B", { name: "Alpha", load: 7.8 })],
      "hardest-subjects",
    ).rows;
    expect(rows.map((r) => r.title)).toEqual(["Alpha", "Zeta"]);
  });
});

describe("shareText", () => {
  it("lists the rows with one decimal", () => {
    const b = board([course("A", { name: "Alpha", exam: 7.44 }), course("B", { name: "Beta", exam: 7.1 })], "toughest-exams");
    expect(shareText(b)).toBe("Toughest exams at TU Delft, according to DelftRate: 1. Alpha (7.4), 2. Beta (7.1). Agree?");
  });

  it("says so for an empty board", () => {
    const text = shareText(board([], "toughest-exams"));
    expect(text).toContain("Toughest exams");
    expect(text).not.toContain("1.");
  });
});

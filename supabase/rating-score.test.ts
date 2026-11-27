// Tests that the published scores follow from the saved ratings: after a new rating and
// after a changed one, the counts and averages a student sees are exactly right, also
// around the minimum of 10 votes. Every number is read as a student of the course's programme.
import type { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCourseSheet } from "../lib/course-sheet";
import { combinedScore, type ProfessorStatsRow, type SubjectStatsRow } from "../lib/score";
import { as, createTestDatabase, createUser } from "./testing/database";

// Every test builds its own database, which takes a moment on a slow machine.
vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 });

type Row = Record<string, unknown>;

const SUBJECT = ["difficulty", "exam_level", "interest"] as const;
const PROFESSOR = ["engagement", "understanding", "approachability"] as const;

let db: PGlite;
let cse: string;
let ada: string;
let bob: string;
let student: string;
let other: string;
let admin: string;

async function one<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Row>(sql, params);
  return Object.values(rows[0])[0] as T;
}

async function rows(userId: string | null, sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await as(db, userId, (tx) => tx.query<Row>(sql, params))).rows;
}

function rate(userId: string, professor: string, values: number[]) {
  return rows(userId, "select public.submit_rating($1, $2, $3, $4, $5, $6, $7, $8)", [cse, professor, ...values]);
}

// Gives one block (the subject, or one professor) `count` votes of `value` on every criterion.
async function giveVotes(professor: string | null, count: number, value: number) {
  for (const criterion of professor ? PROFESSOR : SUBJECT) {
    await rows(
      admin,
      "select public.set_manual_votes(p_course_id => $1, p_professor_id => $2, p_criterion => $3, p_value => $4, p_count => $5)",
      [cse, professor, criterion, value, count],
    );
  }
}

// Counts come back as bigint or number, averages as numeric strings: turn both into numbers.
const num = (value: unknown) => (value === null ? null : Number(value));

async function subject(): Promise<Row> {
  return (await rows(student, "select * from public.course_subject_stats($1)", [cse]))[0];
}

async function professorRow(professor: string): Promise<Row> {
  const found = await rows(student, "select * from public.course_professor_stats($1) where professor_id = $2", [
    cse,
    professor,
  ]);
  return found[0];
}

function expectAverages(row: Row, keys: readonly string[], expected: number[]) {
  keys.forEach((key, i) => expect(Number(row[key]), key).toBeCloseTo(expected[i], 6));
}

// Fresh database for every test: ratings and votes must not leak between them.
beforeEach(async () => {
  db = await createTestDatabase();
  cse = await one("insert into public.courses (code, name, programme_id, year) values ('CSE1', 'Algorithms', 'CSE', 1) returning id");
  ada = await one("insert into public.professors (name) values ('Ada') returning id");
  bob = await one("insert into public.professors (name) values ('Bob') returning id");
  await db.query("insert into public.course_professors (course_id, professor_id) values ($1, $2), ($1, $3)", [cse, ada, bob]);
  student = await createUser(db, { programme: "CSE" });
  other = await createUser(db, { programme: "CSE" });
  admin = await createUser(db, { programme: "AE", admin: true });
});

afterEach(async () => {
  await db.close();
});

describe("the score after rating", () => {
  it("moves the averages to the new mean when a rating lands on a course with 10 votes", async () => {
    await giveVotes(null, 10, 6);
    await giveVotes(ada, 10, 6);
    await rate(student, ada, [10, 8, 4, 9, 7, 5]);

    const s = await subject();
    expect(num(s.votes)).toBe(11);
    expect(s.enough_votes).toBe(true);
    expectAverages(s, SUBJECT, [70 / 11, 68 / 11, 64 / 11]);

    const p = await professorRow(ada);
    expect(num(p.votes)).toBe(11);
    expect(p.enough_votes).toBe(true);
    expectAverages(p, PROFESSOR, [69 / 11, 67 / 11, 65 / 11]);
  });

  it("raises the count below 10 votes without showing averages, until the tenth vote", async () => {
    await giveVotes(null, 8, 6);
    await giveVotes(ada, 8, 6);

    await rate(student, ada, [10, 8, 4, 9, 7, 5]);
    let s = await subject();
    let p = await professorRow(ada);
    expect(num(s.votes)).toBe(9);
    expect(num(p.votes)).toBe(9);
    expect(s.enough_votes).toBe(false);
    expect(p.enough_votes).toBe(false);
    for (const key of SUBJECT) expect(s[key], key).toBeNull();
    for (const key of PROFESSOR) expect(p[key], key).toBeNull();

    await rate(other, ada, [2, 4, 6, 1, 3, 5]);
    s = await subject();
    p = await professorRow(ada);
    expect(num(s.votes)).toBe(10);
    expect(num(p.votes)).toBe(10);
    expect(s.enough_votes).toBe(true);
    expect(p.enough_votes).toBe(true);
    expectAverages(s, SUBJECT, [(48 + 10 + 2) / 10, (48 + 8 + 4) / 10, (48 + 4 + 6) / 10]);
    expectAverages(p, PROFESSOR, [(48 + 9 + 1) / 10, (48 + 7 + 3) / 10, (48 + 5 + 5) / 10]);
  });

  it("changes the averages and keeps the vote count when a rating is changed", async () => {
    await giveVotes(null, 10, 6);
    await giveVotes(ada, 10, 6);

    await rate(student, ada, [10, 10, 10, 10, 10, 10]);
    await rate(student, ada, [0, 2, 4, 1, 3, 5]);

    const s = await subject();
    const p = await professorRow(ada);
    // Still 11 votes, not 12: the second rating replaced the first.
    expect(num(s.votes)).toBe(11);
    expect(num(p.votes)).toBe(11);
    expectAverages(s, SUBJECT, [60 / 11, 62 / 11, 64 / 11]);
    expectAverages(p, PROFESSOR, [61 / 11, 63 / 11, 65 / 11]);
  });

  it("counts one subject vote when the same student rates two professors", async () => {
    await giveVotes(null, 10, 6);
    await giveVotes(ada, 10, 6);
    await giveVotes(bob, 10, 6);

    await rate(student, ada, [2, 4, 6, 8, 8, 8]);
    await rate(student, bob, [10, 10, 10, 4, 4, 4]);

    const s = await subject();
    expect(num(s.votes)).toBe(11);
    // The subject values sent last count, not the first ones and not both.
    expectAverages(s, SUBJECT, [70 / 11, 70 / 11, 70 / 11]);

    const a = await professorRow(ada);
    const b = await professorRow(bob);
    expect(num(a.votes)).toBe(11);
    expect(num(b.votes)).toBe(11);
    expectAverages(a, PROFESSOR, [68 / 11, 68 / 11, 68 / 11]);
    expectAverages(b, PROFESSOR, [64 / 11, 64 / 11, 64 / 11]);
  });

  it("shows on the course sheet only from the tenth vote, with the right combined score", async () => {
    await giveVotes(null, 8, 6);
    await giveVotes(ada, 8, 6);

    // The page lists the professors of the course and reads both stats functions.
    async function sheet() {
      const professors = (
        await db.query<{ id: string; name: string }>(
          "select p.id, p.name from public.course_professors cp join public.professors p on p.id = cp.professor_id where cp.course_id = $1",
          [cse],
        )
      ).rows.map((p) => ({ ...p, hidden: false }));
      const subjectRow = (await subject()) as unknown as SubjectStatsRow;
      const professorRows = await rows(student, "select * from public.course_professor_stats($1)", [cse]);
      const typed = professorRows.map((row) => ({
        ...row,
        votes: Number(row.votes),
        ...Object.fromEntries([...PROFESSOR].map((key) => [key, num(row[key])])),
      })) as unknown as ProfessorStatsRow[];
      const typedSubject = {
        ...subjectRow,
        votes: Number(subjectRow.votes),
        ...Object.fromEntries([...SUBJECT].map((key) => [key, num((subjectRow as unknown as Row)[key])])),
      } as unknown as SubjectStatsRow;
      return { sheet: buildCourseSheet(professors, typedSubject, typed), typedSubject, typed };
    }

    await rate(student, ada, [10, 8, 4, 9, 7, 5]);
    const before = (await sheet()).sheet;
    expect(before.subject.votes).toBe(9);
    expect(before.subject.averages).toBeNull();
    expect(before.professors.find((p) => p.id === ada)?.combined).toBeNull();

    await rate(other, ada, [2, 4, 6, 1, 3, 5]);
    const { sheet: after, typedSubject, typed } = await sheet();
    expect(after.subject.votes).toBe(10);
    expect(after.subject.averages).not.toBeNull();
    const combined = after.professors.find((p) => p.id === ada)?.combined;
    expect(combined).not.toBeNull();

    const adaRow = typed.find((row) => row.professor_id === ada)!;
    const expected = combinedScore(
      {
        difficulty: typedSubject.difficulty!,
        exam_level: typedSubject.exam_level!,
        interest: typedSubject.interest!,
      },
      {
        engagement: adaRow.engagement!,
        understanding: adaRow.understanding!,
        approachability: adaRow.approachability!,
      },
    );
    expect(combined!.score).toBeCloseTo(expected, 9);
  });
});

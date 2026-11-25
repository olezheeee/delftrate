import type { PGlite } from "@electric-sql/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import { as, createTestDatabase, createUser } from "../../supabase/testing/database";
import type { Course } from "./schema";
import { dollarQuote, importSql, TOTALS_SQL } from "./sql";

vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 });

let db: PGlite;
afterEach(async () => {
  // A test that builds no database leaves the previous one here, already closed.
  if (db && !db.closed) await db.close();
});

function course(code: string, professors: string[], extra: Partial<Course> = {}): Course {
  return { code, name: `Course ${code}`, programme: "CSE", year: 1, quarters: [1, 2], professors, ...extra };
}

// query, not exec: query sends one prepared statement, which (like `supabase db query
// --file`) may hold only one command. exec would accept a multi-statement script that the
// real command refuses.
async function run(courses: Course[]) {
  await db.query(importSql(courses));
}

async function count(table: string): Promise<number> {
  const { rows } = await db.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
  return rows[0].n;
}

async function snapshot() {
  const out: Record<string, unknown[]> = {};
  for (const t of ["courses", "professors", "course_professors"]) {
    out[t] = (await db.query(`select * from public.${t} order by 1, 2`)).rows;
  }
  return out;
}

const DATA = [
  course("T1", ["Ada", "Bob"]),
  course("T2", ["Bob"], { programme: "AE", year: 2 }),
];

describe("course import SQL", () => {
  it("creates courses, professors and links", async () => {
    db = await createTestDatabase();
    await run(DATA);
    expect(await count("courses")).toBe(2);
    expect(await count("professors")).toBe(2); // Bob teaches two courses, exists once
    expect(await count("course_professors")).toBe(3);
    const { rows } = await db.query<{ code: string; names: string }>(
      `select c.code, string_agg(p.name, ',' order by p.name) as names
       from public.courses c join public.course_professors cp on cp.course_id = c.id
       join public.professors p on p.id = cp.professor_id group by c.code order by c.code`,
    );
    expect(rows).toEqual([
      { code: "T1", names: "Ada,Bob" },
      { code: "T2", names: "Bob" },
    ]);
    const t2 = await db.query<{ programme_id: string; year: number }>(
      "select programme_id, year from public.courses where code = 'T2'",
    );
    expect(t2.rows[0]).toEqual({ programme_id: "AE", year: 2 });
  });

  it("leaves the same rows when run twice", async () => {
    db = await createTestDatabase();
    await run(DATA);
    const first = await snapshot();
    await run(DATA);
    expect(await snapshot()).toEqual(first);
  });

  it("keeps a rating when the course is imported again with a new name and year", async () => {
    db = await createTestDatabase();
    await run(DATA);
    const ids = async () =>
      (await db.query<{ c: string; p: string }>(
        `select c.id as c, p.id as p from public.courses c, public.professors p
         where c.code = 'T1' and p.name = 'Ada'`,
      )).rows[0];
    const { c, p } = await ids();
    const student = await createUser(db, { programme: "CSE" });
    await as(db, student, (tx) =>
      tx.query("select public.submit_rating($1, $2, 6, 6, 6, 6, 6, 6)", [c, p]),
    );

    await run([
      course("T1", ["Ada", "Bob"], { name: "Renamed", year: 3 }),
      DATA[1],
    ]);

    const after = await db.query<{ id: string; name: string; year: number }>(
      "select id, name, year from public.courses where code = 'T1'",
    );
    expect(after.rows[0]).toEqual({ id: c, name: "Renamed", year: 3 });
    expect((await ids()).c).toBe(c);
    const ratings = await db.query<{ n: number }>(
      "select count(*)::int as n from public.professor_ratings where course_id = $1 and professor_id = $2",
      [c, p],
    );
    expect(ratings.rows[0].n).toBe(1);
  });

  it("reuses existing professors and leaves other seed data alone", async () => {
    db = await createTestDatabase({ seed: true });
    const before = await snapshot();
    const seedProfessors = await count("professors");
    const seedCourses = await count("courses");
    await run([course("NEW1", ["Dr. Marijke van Houten", "Newcomer"])]);
    expect(await count("professors")).toBe(seedProfessors + 1);
    expect(await count("courses")).toBe(seedCourses + 1);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from public.professors where name = 'Dr. Marijke van Houten'",
    );
    expect(rows[0].n).toBe(1);
    // every row that existed before is still there, unchanged
    for (const table of ["courses", "professors", "course_professors"] as const) {
      const now = await snapshot();
      for (const row of before[table]) expect(now[table]).toContainEqual(row);
    }
  });

  it("is a single statement, as `supabase db query --file` requires, also for awkward data", async () => {
    db = await createTestDatabase();
    // Names that contain dollar-quote tags must not end either literal early.
    const tricky = [course("D1", ["Dr. $import$ Tag", "Prof. $import_json$ Tag"], { name: "Costs $$ and $x$" })];
    await run(tricky); // query() rejects more than one command, like the CLI
    const { rows } = await db.query<{ name: string }>("select name from public.professors order by name");
    expect(rows.map((r) => r.name)).toEqual(["Dr. $import$ Tag", "Prof. $import_json$ Tag"]);
    const c = await db.query<{ name: string }>("select name from public.courses where code = 'D1'");
    expect(c.rows[0].name).toBe("Costs $$ and $x$");
  });

  it("reports the totals in a separate single statement", async () => {
    db = await createTestDatabase();
    await run(DATA);
    const { rows } = await db.query<Record<string, unknown>>(TOTALS_SQL);
    const totals = Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
    expect(totals).toEqual({ courses: 2, professors: 2, course_professors: 3 });
  });

  it("stops and changes nothing when a name matches two professors", async () => {
    db = await createTestDatabase();
    await db.exec("insert into public.professors (name) values ('Twin'), ('Twin'), ('Solo')");
    const before = await snapshot();
    await expect(run([course("T9", ["Solo", "Twin", "Fresh"])])).rejects.toThrow(/'Twin'/);
    expect(await snapshot()).toEqual(before);
  });

  it("round-trips quotes, apostrophes and backslashes exactly", async () => {
    db = await createTestDatabase();
    // String.raw keeps the backslashes: in a plain template literal `\ ` is just a space.
    const name = String.raw`"Quoted" Course \ back's 'slash' \n \\`;
    const prof = String.raw`Dr. Seán O'Neill \ "Q"`;
    expect(name).toContain("\\");
    await run([course("Q1", [prof], { name })]);
    const c = await db.query<{ name: string }>("select name from public.courses where code = 'Q1'");
    expect(c.rows[0].name).toBe(name);
    const p = await db.query<{ name: string }>("select name from public.professors");
    expect(p.rows.map((r) => r.name)).toEqual([prof]);
  });

  // PGlite refuses standard_conforming_strings = off, so this is checked on the SQL text:
  // the data sits in the script byte for byte, inside dollar quotes, with no escaping that
  // a server setting could read differently.
  it("embeds the data verbatim in a dollar-quoted literal, not an escaped one", () => {
    const data = [course("S1", ["Ada"], { name: String.raw`a\nb "q" c's` })];
    const sql = importSql(data);
    const json = JSON.stringify(data.map(({ code, name, programme, year, professors }) => ({ code, name, programme, year, professors })));
    expect(sql).toContain(`$import_json$${json}$import_json$::jsonb`);
  });

  it("chooses a dollar-quote tag that cannot end the literal early", () => {
    expect(dollarQuote("plain")).toBe("$import_json$plain$import_json$");
    expect(dollarQuote("x $import_json$ y")).toBe("$import_json_1$x $import_json$ y$import_json_1$");
    expect(dollarQuote("ends in $import_json")).toBe("$import_json_1$ends in $import_json$import_json_1$");
  });

  it("stops and changes nothing when a name differs only in capitals or spaces from one in the database", async () => {
    db = await createTestDatabase();
    await db.exec("insert into public.professors (name) values ('Dr.  Jane DOE')");
    const before = await snapshot();
    await expect(run([course("N1", ["Dr. Jane Doe"])])).rejects.toThrow(/'Dr\. Jane Doe' in the files, 'Dr\.  Jane DOE' in the database/);
    expect(await snapshot()).toEqual(before);
  });

  it("does not rewrite a course whose data did not change", async () => {
    db = await createTestDatabase();
    await run(DATA);
    const version = async () =>
      (await db.query<{ v: string }>("select xmin::text as v from public.courses where code = 'T1'")).rows[0].v;
    const first = await version();
    await run(DATA);
    expect(await version()).toBe(first);
    await run([course("T1", ["Ada", "Bob"], { name: "Renamed" }), DATA[1]]);
    expect(await version()).not.toBe(first);
  });

  it("does not write quarters and does not change the schema", async () => {
    db = await createTestDatabase();
    const columns = async () =>
      (await db.query("select column_name from information_schema.columns where table_name = 'courses' order by 1")).rows;
    const before = await columns();
    await run([course("QU1", ["Ada"], { quarters: [1, 2, 3, 4] })]);
    expect(await columns()).toEqual(before);
    expect(await count("courses")).toBe(1);
  });
});

// Tests of the database itself: the migrations are loaded into a real Postgres (PGlite)
// and every access rule is tried as a signed-out visitor, a student and an admin.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  courseScore,
  defaultProfessor,
  load,
  teach,
  VERDICT_LABELS,
  type ProfessorAverages,
  type ProfessorStats,
  type SubjectAverages,
  type SubjectStats,
} from "../lib/score";
import { as, createTestDatabase, createUser } from "./testing/database";

// Every test builds its own database, which takes a moment on a slow machine.
vi.setConfig({ hookTimeout: 60_000, testTimeout: 60_000 });

type Row = Record<string, unknown>;

const SUBJECT = ["difficulty", "exam_level", "interest"] as const;
const PROFESSOR = ["engagement", "understanding", "approachability"] as const;

let db: PGlite;
let cse: string; // a Computer Science course
let ae: string; // an Aerospace course
let ada: string; // teaches the CSE course
let bob: string; // also teaches the CSE course
let eve: string; // teaches the AE course
let student: string; // CSE student
let other: string; // another CSE student
let aeStudent: string;
let admin: string;

async function one<T = unknown>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query<Row>(sql, params);
  return Object.values(rows[0])[0] as T;
}

async function rows(userId: string | null, sql: string, params: unknown[] = []): Promise<Row[]> {
  return (await as(db, userId, (tx) => tx.query<Row>(sql, params))).rows;
}

function rate(userId: string | null, course: string, professor: string, values: (number | null)[]) {
  return rows(userId, "select public.submit_rating($1, $2, $3, $4, $5, $6, $7, $8)", [
    course,
    professor,
    ...values,
  ]);
}

function setManualVotes(
  userId: string | null,
  course: string,
  professor: string | null,
  criterion: string,
  value: number,
  count: number,
) {
  return rows(
    userId,
    "select public.set_manual_votes(p_course_id => $1, p_professor_id => $2, p_criterion => $3, p_value => $4, p_count => $5)",
    [course, professor, criterion, value, count],
  );
}

async function subjectStats(userId: string | null, course: string): Promise<Row> {
  const found = await rows(userId, "select * from public.course_subject_stats($1)", [course]);
  return found[0];
}

async function professorStats(userId: string | null, course: string, professor: string): Promise<Row | undefined> {
  const found = await rows(
    userId,
    "select * from public.course_professor_stats($1) where professor_id = $2",
    [course, professor],
  );
  return found[0];
}

// Fresh database for every test: they change votes and flags, and must not see each other.
beforeEach(async () => {
  db = await createTestDatabase();
  cse = await one("insert into public.courses (code, name, programme_id, year) values ('CSE1', 'Algorithms', 'CSE', 1) returning id");
  ae = await one("insert into public.courses (code, name, programme_id, year) values ('AE1', 'Aerodynamics', 'AE', 1) returning id");
  ada = await one("insert into public.professors (name) values ('Ada') returning id");
  bob = await one("insert into public.professors (name) values ('Bob') returning id");
  eve = await one("insert into public.professors (name) values ('Eve') returning id");
  await db.query(
    "insert into public.course_professors (course_id, professor_id) values ($1, $2), ($1, $3), ($4, $5)",
    [cse, ada, bob, ae, eve],
  );
  student = await createUser(db, { programme: "CSE" });
  other = await createUser(db, { programme: "CSE" });
  aeStudent = await createUser(db, { programme: "AE" });
  admin = await createUser(db, { programme: "AE", admin: true });
});

afterEach(async () => {
  await db.close();
});

describe("a signed-out visitor", () => {
  it("reads the programmes and the courses, and nothing else", async () => {
    expect(await rows(null, "select id from public.programmes order by id")).toEqual([{ id: "AE" }, { id: "CSE" }]);
    // The calendar on the home page is public: code, name, programme, year and quarters.
    expect(
      await rows(null, "select code, name, programme_id, year, quarters from public.courses order by code"),
    ).toMatchObject([
      { code: "AE1", programme_id: "AE", quarters: [] },
      { code: "CSE1", programme_id: "CSE", quarters: [] },
    ]);
    // Those five columns and no others: not the internal id, not when the row was made.
    for (const columns of ["id", "created_at", "*"]) {
      await expect(rows(null, `select ${columns} from public.courses`), columns).rejects.toThrow(/permission denied/);
    }
    await expect(rows(null, "update public.courses set name = 'x'")).rejects.toThrow(/permission denied/);
    await expect(rows(null, "delete from public.courses")).rejects.toThrow(/permission denied/);
    await expect(
      rows(null, "insert into public.courses (code, name, programme_id, year) values ('X1', 'x', 'AE', 1)"),
    ).rejects.toThrow(/permission denied/);

    for (const table of [
      "profiles",
      "professors",
      "course_professors",
      "subject_ratings",
      "professor_ratings",
      "manual_votes",
      "manual_vote_changes",
    ]) {
      await expect(rows(null, `select * from public.${table}`), table).rejects.toThrow(/permission denied/);
    }
  });

  it("reads no averages and cannot rate", async () => {
    await expect(rows(null, "select * from public.course_subject_stats()")).rejects.toThrow(/permission denied/);
    await expect(rows(null, "select * from public.course_professor_stats()")).rejects.toThrow(/permission denied/);
    await expect(rate(null, cse, ada, [5, 5, 5, 5, 5, 5])).rejects.toThrow(/permission denied/);
    await expect(setManualVotes(null, cse, null, "difficulty", 5, 10)).rejects.toThrow(/permission denied/);
  });
});

describe("profiles", () => {
  it("a user reads only their own profile, an admin reads all", async () => {
    expect(await rows(student, "select id from public.profiles")).toEqual([{ id: student }]);
    expect(await rows(admin, "select id from public.profiles")).toHaveLength(4);
  });

  it("a user creates their own profile, but not someone else's and not as admin", async () => {
    const fresh = await one<string>("insert into auth.users default values returning id");
    const stranger = await one<string>("insert into auth.users default values returning id");

    await expect(
      rows(fresh, "insert into public.profiles (id, programme_id, year) values ($1, 'AE', 1)", [stranger]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      rows(fresh, "insert into public.profiles (id, programme_id, year, is_admin) values ($1, 'AE', 1, true)", [fresh]),
    ).rejects.toThrow(/permission denied/);

    await rows(fresh, "insert into public.profiles (id, programme_id, year) values ($1, 'AE', 2)", [fresh]);
    expect(await rows(fresh, "select programme_id, year, is_admin from public.profiles")).toEqual([
      { programme_id: "AE", year: 2, is_admin: false },
    ]);
  });

  it("a user changes their year, but not the admin flag or the programme", async () => {
    await rows(student, "update public.profiles set year = 2 where id = $1", [student]);
    expect(await one("select year from public.profiles where id = $1", [student])).toBe(2);

    await expect(rows(student, "update public.profiles set is_admin = true where id = $1", [student])).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      rows(student, "update public.profiles set programme_id = 'AE' where id = $1", [student]),
    ).rejects.toThrow(/permission denied/);

    // Someone else's row is simply not there to update.
    await rows(student, "update public.profiles set year = 5 where id = $1", [other]);
    expect(await one("select year from public.profiles where id = $1", [other])).toBe(1);
  });
});

describe("cancelling an unfinished registration", () => {
  const cancel = (userId: string | null) =>
    rows(userId, "select public.cancel_unfinished_registration() as removed");
  const accounts = () => one<number>("select count(*)::int from auth.users");

  it("removes the caller's own account while it has no profile, and no other account", async () => {
    const fresh = await one<string>("insert into auth.users default values returning id");
    const stranger = await one<string>("insert into auth.users default values returning id");
    const before = await accounts();

    expect(await cancel(fresh)).toEqual([{ removed: true }]);
    expect(await accounts()).toBe(before - 1);
    expect(await one("select count(*)::int from auth.users where id = $1", [fresh])).toBe(0);
    expect(await one("select count(*)::int from auth.users where id = $1", [stranger])).toBe(1);

    // A second call finds nothing left to remove.
    expect(await cancel(fresh)).toEqual([{ removed: false }]);
  });

  it("never removes an account that has a profile", async () => {
    const before = await accounts();
    expect(await cancel(student)).toEqual([{ removed: false }]);
    expect(await cancel(admin)).toEqual([{ removed: false }]);
    expect(await accounts()).toBe(before);
    expect(await rows(student, "select id from public.profiles")).toEqual([{ id: student }]);
  });

  it("is closed to a signed-out visitor", async () => {
    await expect(cancel(null)).rejects.toThrow(/permission denied/);
  });
});

describe("confirming an email address", () => {
  // Supabase Auth writes to auth.users as the owner of that table, not through the API roles.
  const unconfirmed = () =>
    one<string>("insert into auth.users (encrypted_password) values ('set-by-a-stranger') returning id");
  const password = (id: string) =>
    one<string | null>("select encrypted_password from auth.users where id = $1", [id]);

  it("forgets the password the account had before", async () => {
    const id = await unconfirmed();
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    expect(await password(id)).toBeNull();
  });

  it("keeps a password that is set in the same write", async () => {
    const id = await unconfirmed();
    await db.query(
      "update auth.users set email_confirmed_at = now(), encrypted_password = 'chosen-by-a-lead' where id = $1",
      [id],
    );
    expect(await password(id)).toBe("chosen-by-a-lead");
  });

  // Supabase Auth creates an account for a lead (the admin API with "email_confirm") in
  // one transaction: the account with its password first, other writes, the confirmation last.
  it("keeps the password of an account that is created and confirmed in one transaction", async () => {
    const id = await db.transaction(async (tx) => {
      const made = await tx.query<{ id: string }>(
        "insert into auth.users (encrypted_password) values ('chosen-by-a-lead') returning id",
      );
      const id = made.rows[0].id;
      await tx.query("update auth.users set email = 'lead-made@example.com' where id = $1", [id]);
      await tx.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
      return id;
    });
    expect(await password(id)).toBe("chosen-by-a-lead");
  });

  it("still forgets the password when the confirmation comes in a later transaction", async () => {
    // A stranger signs up for someone else's address: one transaction.
    const id = await db.transaction(async (tx) => {
      const made = await tx.query<{ id: string }>(
        "insert into auth.users (encrypted_password) values ('set-by-a-stranger') returning id",
      );
      return made.rows[0].id;
    });
    // The owner confirms the address: another transaction, on the same connection.
    await db.transaction(async (tx) => {
      await tx.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    });
    expect(await password(id)).toBeNull();
  });

  it("forgets a stranger's password also when the same transaction creates another account", async () => {
    const strangers = await unconfirmed();
    const other = await db.transaction(async (tx) => {
      const made = await tx.query<{ id: string }>(
        "insert into auth.users (encrypted_password) values ('chosen-by-a-lead') returning id",
      );
      await tx.query("update auth.users set email_confirmed_at = now() where id = $1", [strangers]);
      await tx.query("update auth.users set email_confirmed_at = now() where id = $1", [made.rows[0].id]);
      return made.rows[0].id;
    });
    expect(await password(strangers)).toBeNull();
    expect(await password(other)).toBe("chosen-by-a-lead");
  });

  it("keeps nothing from a transaction that was rolled back", async () => {
    const id = await unconfirmed();
    // A transaction notes a new account and fails. Its note must not outlive it.
    await expect(
      db.transaction(async (tx) => {
        await tx.query("insert into auth.users (encrypted_password) values ('x')");
        await tx.query("select set_config('delftrate.new_account', $1, true)", [id]);
        throw new Error("stop");
      }),
    ).rejects.toThrow("stop");
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    expect(await password(id)).toBeNull();
  });

  it("leaves the password alone before and after the confirmation", async () => {
    const id = await unconfirmed();
    // Not confirmed yet: other changes to the account do not touch the password.
    await db.query("update auth.users set email = 'someone@example.com' where id = $1", [id]);
    expect(await password(id)).toBe("set-by-a-stranger");

    // Confirmed, then the owner saves a password: it stays through every later change.
    await db.query("update auth.users set email_confirmed_at = now() where id = $1", [id]);
    await db.query("update auth.users set encrypted_password = 'chosen-by-the-owner' where id = $1", [id]);
    await db.query(
      "update auth.users set email_confirmed_at = now() + interval '1 day', email = 'other@example.com' where id = $1",
      [id],
    );
    expect(await password(id)).toBe("chosen-by-the-owner");
  });
});

describe("the quarters of a course", () => {
  const setQuarters = (value: string) =>
    db.query("update public.courses set quarters = $1::smallint[] where id = $2", [value, cse]);

  it("accepts one to four different quarters, and none at all", async () => {
    for (const value of ["{}", "{1}", "{2,3}", "{1,2,3,4}"]) await setQuarters(value);
    expect(await one("select quarters from public.courses where id = $1", [cse])).toEqual([1, 2, 3, 4]);
  });

  it("refuses a quarter that does not exist, a repeated one, an empty one and a nested list", async () => {
    for (const value of ["{0}", "{5}", "{1,1}", "{1,NULL}", "{{1,2},{3,4}}"]) {
      await expect(setQuarters(value), value).rejects.toThrow(/courses_quarters_valid/);
    }
  });
});

describe("courses and professors", () => {
  it("a signed-in user reads them and cannot change them", async () => {
    expect(await rows(student, "select code from public.courses order by code")).toEqual([{ code: "AE1" }, { code: "CSE1" }]);
    expect(await rows(student, "select name from public.professors order by name")).toHaveLength(3);
    expect(await rows(student, "select * from public.course_professors")).toHaveLength(3);

    await expect(
      rows(student, "insert into public.courses (code, name, programme_id, year) values ('X', 'X', 'AE', 1)"),
    ).rejects.toThrow(/row-level security/);
    await expect(rows(student, "insert into public.professors (name) values ('X')")).rejects.toThrow(/row-level security/);

    await rows(student, "update public.professors set hidden = true");
    await rows(student, "update public.courses set name = 'Hacked'");
    await rows(student, "delete from public.course_professors");
    await rows(student, "delete from public.courses");
    expect(await one("select count(*)::int from public.professors where hidden")).toBe(0);
    expect(await one("select count(*)::int from public.courses where name = 'Hacked'")).toBe(0);
    expect(await one("select count(*)::int from public.course_professors")).toBe(3);
  });

  it("an admin adds, changes and removes them", async () => {
    await rows(admin, "insert into public.courses (code, name, programme_id, year) values ('AE2', 'Flight', 'AE', 2)");
    await rows(admin, "insert into public.professors (name) values ('Dan')");
    await rows(admin, "update public.professors set hidden = true where id = $1", [bob]);
    await rows(admin, "delete from public.course_professors where professor_id = $1", [eve]);
    expect(await one("select count(*)::int from public.courses")).toBe(3);
    expect(await one("select count(*)::int from public.professors")).toBe(4);
    expect(await one("select hidden from public.professors where id = $1", [bob])).toBe(true);
    expect(await one("select count(*)::int from public.course_professors")).toBe(2);
  });
});

describe("rating a course", () => {
  it("saves all six values and shows them to their owner only", async () => {
    await rate(student, cse, ada, [7, 7.5, 8, 9, 9.5, 10]);

    expect(await rows(student, "select difficulty, exam_level, interest from public.subject_ratings")).toEqual([
      { difficulty: "7.0", exam_level: "7.5", interest: "8.0" },
    ]);
    expect(
      await rows(student, "select engagement, understanding, approachability from public.professor_ratings"),
    ).toEqual([{ engagement: "9.0", understanding: "9.5", approachability: "10.0" }]);

    // Nobody else reads the individual rating, not even an admin.
    for (const reader of [other, admin]) {
      expect(await rows(reader, "select * from public.subject_ratings")).toEqual([]);
      expect(await rows(reader, "select * from public.professor_ratings")).toEqual([]);
    }
  });

  it("is refused for a course outside the user's programme", async () => {
    await expect(rate(student, ae, eve, [5, 5, 5, 5, 5, 5])).rejects.toThrow(/own programme/);
    await expect(rate(aeStudent, cse, ada, [5, 5, 5, 5, 5, 5])).rejects.toThrow(/own programme/);
    await rate(aeStudent, ae, eve, [5, 5, 5, 5, 5, 5]);
    expect(await one("select count(*)::int from public.subject_ratings")).toBe(1);
  });

  it("is refused with fewer than six values, and then nothing at all is saved", async () => {
    for (let missing = 0; missing < 6; missing++) {
      const values: (number | null)[] = [5, 5, 5, 5, 5, 5];
      values[missing] = null;
      await expect(rate(student, cse, ada, values), `value ${missing}`).rejects.toThrow(/all six values/);
    }
    // Sent with only the three subject values: there is no such function to call.
    await expect(
      rows(student, "select public.submit_rating($1, $2, 5, 5, 5)", [cse, ada]),
    ).rejects.toThrow(/does not exist/);

    expect(await one("select count(*)::int from public.subject_ratings")).toBe(0);
    expect(await one("select count(*)::int from public.professor_ratings")).toBe(0);
  });

  it("is refused for a value outside 0 to 10 or off the 0.5 steps", async () => {
    for (const bad of [-0.5, 10.5, 7.2, 7.24, 7.25]) {
      await expect(rate(student, cse, ada, [bad, 5, 5, 5, 5, 5]), `${bad}`).rejects.toThrow(/steps of 0.5/);
      await expect(rate(student, cse, ada, [5, 5, 5, 5, 5, bad]), `${bad}`).rejects.toThrow(/steps of 0.5/);
    }
    expect(await one("select count(*)::int from public.subject_ratings")).toBe(0);
  });

  it("is refused for a professor who does not teach the course", async () => {
    await expect(rate(student, cse, eve, [5, 5, 5, 5, 5, 5])).rejects.toThrow(/does not teach/);
    expect(await one("select count(*)::int from public.subject_ratings")).toBe(0);
  });

  it("cannot be written around the function, for oneself or for someone else", async () => {
    for (const user of [student, other]) {
      await expect(
        rows(
          student,
          "insert into public.subject_ratings (user_id, course_id, difficulty, exam_level, interest) values ($1, $2, 5, 5, 5)",
          [user, cse],
        ),
      ).rejects.toThrow(/permission denied/);
    }

    await rate(other, cse, ada, [5, 5, 5, 5, 5, 5]);
    await expect(rows(student, "update public.subject_ratings set difficulty = 0")).rejects.toThrow(/permission denied/);
    await expect(rows(student, "delete from public.subject_ratings")).rejects.toThrow(/permission denied/);
    await expect(rows(student, "update public.professor_ratings set engagement = 0")).rejects.toThrow(/permission denied/);
    await expect(rows(student, "delete from public.professor_ratings")).rejects.toThrow(/permission denied/);
    await expect(rows(admin, "delete from public.subject_ratings")).rejects.toThrow(/permission denied/);
  });

  it("replaces the earlier rating instead of adding a second vote", async () => {
    await rate(student, cse, ada, [2, 2, 2, 2, 2, 2]);
    await rate(student, cse, ada, [8, 8, 8, 8, 8, 8]);

    expect(await one("select count(*)::int from public.subject_ratings")).toBe(1);
    expect(await one("select count(*)::int from public.professor_ratings")).toBe(1);
    expect((await subjectStats(admin, cse)).votes).toBe(1);
    expect(Number((await subjectStats(admin, cse)).difficulty)).toBe(8);
  });

  it("keeps one subject rating when the user rates a second professor of the course", async () => {
    await rate(student, cse, ada, [2, 2, 2, 9, 9, 9]);
    await rate(student, cse, bob, [6, 6, 6, 4, 4, 4]);

    expect(await one("select count(*)::int from public.subject_ratings")).toBe(1);
    expect(await one("select count(*)::int from public.professor_ratings")).toBe(2);
    expect(Number((await subjectStats(admin, cse)).difficulty)).toBe(6);
    expect(Number((await professorStats(admin, cse, ada))?.engagement)).toBe(9);
    expect(Number((await professorStats(admin, cse, bob))?.engagement)).toBe(4);
  });
});

describe("manual votes", () => {
  it("cannot be read or changed by a non-admin", async () => {
    await setManualVotes(admin, cse, null, "difficulty", 5, 30);

    expect(await rows(student, "select * from public.manual_votes")).toEqual([]);
    expect(await rows(student, "select * from public.manual_vote_changes")).toEqual([]);
    await expect(setManualVotes(student, cse, null, "difficulty", 5, 0)).rejects.toThrow(/row-level security/);
    await expect(setManualVotes(student, cse, null, "interest", 5, 10)).rejects.toThrow(/row-level security/);
    await expect(
      rows(student, "insert into public.manual_votes (course_id, criterion, value, count) values ($1, 'interest', 5, 10)", [cse]),
    ).rejects.toThrow(/row-level security/);
    await rows(student, "update public.manual_votes set count = 0");
    await expect(rows(student, "delete from public.manual_votes")).rejects.toThrow(/permission denied/);
    await expect(
      rows(student, "insert into public.manual_vote_changes (course_id, criterion, value, old_count, new_count) values ($1, 'interest', 5, 0, 10)", [cse]),
    ).rejects.toThrow(/permission denied/);

    expect(await one("select count from public.manual_votes")).toBe(30);
  });

  it("are overwritten, not added up, and every change is logged", async () => {
    await setManualVotes(admin, cse, null, "difficulty", 5, 30);
    await setManualVotes(admin, cse, null, "difficulty", 5, 20);
    await setManualVotes(admin, cse, null, "difficulty", 5, 20); // no change, no log line
    await setManualVotes(admin, cse, null, "difficulty", 8, 10);

    expect(await rows(admin, "select value, count from public.manual_votes order by value")).toEqual([
      { value: 5, count: 20 },
      { value: 8, count: 10 },
    ]);
    expect(
      await rows(admin, "select changed_by, criterion, value, old_count, new_count from public.manual_vote_changes order by id"),
    ).toEqual([
      { changed_by: admin, criterion: "difficulty", value: 5, old_count: 0, new_count: 30 },
      { changed_by: admin, criterion: "difficulty", value: 5, old_count: 30, new_count: 20 },
      { changed_by: admin, criterion: "difficulty", value: 8, old_count: 0, new_count: 10 },
    ]);
    // (20 × 5 + 10 × 8) / 30
    expect(Number((await subjectStats(admin, cse)).difficulty)).toBe(6);
    expect((await subjectStats(admin, cse)).difficulty_votes).toBe(30);
  });

  it("stay within 0 to 50 votes and whole values 0 to 10", async () => {
    await expect(setManualVotes(admin, cse, null, "difficulty", 5, 51)).rejects.toThrow(/check constraint/);
    await expect(setManualVotes(admin, cse, null, "difficulty", 5, -1)).rejects.toThrow(/check constraint/);
    await expect(setManualVotes(admin, cse, null, "difficulty", 11, 5)).rejects.toThrow(/check constraint/);
    await setManualVotes(admin, cse, null, "difficulty", 0, 50);
    await setManualVotes(admin, cse, null, "difficulty", 10, 0);
  });

  it("name a professor for the professor criteria and none for the subject criteria", async () => {
    await expect(setManualVotes(admin, cse, null, "engagement", 5, 5)).rejects.toThrow(/professor_matches_criterion/);
    await expect(setManualVotes(admin, cse, ada, "difficulty", 5, 5)).rejects.toThrow(/professor_matches_criterion/);
    await expect(setManualVotes(admin, cse, eve, "engagement", 5, 5)).rejects.toThrow(/foreign key/);
    await setManualVotes(admin, cse, ada, "engagement", 5, 5);
  });

  it("leave their log behind when the course is removed, with the votes logged as gone", async () => {
    await setManualVotes(admin, cse, ada, "engagement", 5, 30);
    await rows(admin, "delete from public.courses where id = $1", [cse]);

    expect(await one("select count(*)::int from public.manual_votes")).toBe(0);
    expect(
      await rows(admin, "select course_id, professor_id, old_count, new_count from public.manual_vote_changes order by id"),
    ).toEqual([
      { course_id: cse, professor_id: ada, old_count: 0, new_count: 30 },
      { course_id: cse, professor_id: ada, old_count: 30, new_count: 0 },
    ]);
  });

  it("cannot have their log rewritten, and an admin cannot move a count to another course", async () => {
    await setManualVotes(admin, cse, null, "difficulty", 5, 30);
    await expect(rows(admin, "update public.manual_vote_changes set new_count = 0")).rejects.toThrow(/permission denied/);
    await expect(rows(admin, "delete from public.manual_vote_changes")).rejects.toThrow(/permission denied/);
    await expect(rows(admin, "update public.manual_votes set course_id = $1", [ae])).rejects.toThrow(/permission denied/);
  });
});

describe("averages", () => {
  it("count student ratings and manual votes together", async () => {
    await rate(student, cse, ada, [10, 10, 10, 10, 10, 10]);
    await rate(other, cse, ada, [9, 9, 9, 9, 9, 9]);
    await setManualVotes(admin, cse, null, "difficulty", 4, 8);
    await setManualVotes(admin, cse, ada, "engagement", 6, 3);

    const subject = await subjectStats(admin, cse);
    expect(Number(subject.difficulty)).toBeCloseTo((10 + 9 + 8 * 4) / 10);
    expect(Number(subject.exam_level)).toBe(9.5);
    expect(subject).toMatchObject({ difficulty_votes: 10, exam_level_votes: 2, interest_votes: 2, votes: 2, enough_votes: false });

    const professor = await professorStats(admin, cse, ada);
    expect(Number(professor?.engagement)).toBeCloseTo((10 + 9 + 3 * 6) / 5);
    expect(professor).toMatchObject({ engagement_votes: 5, understanding_votes: 2, votes: 2, enough_votes: false });
  });

  it("return a row with zero votes for a course nobody rated", async () => {
    expect(await subjectStats(student, ae)).toMatchObject({ difficulty: null, votes: 0, enough_votes: false });
    expect(await professorStats(student, ae, eve)).toMatchObject({ engagement: null, votes: 0, enough_votes: false });
  });
});

describe("the minimum of 10 votes", () => {
  it("is 10", async () => {
    expect(await one("select public.min_votes()")).toBe(10);
  });

  it("hides a subject block with 9 votes from a non-admin and shows it with 10", async () => {
    // 1 student vote and 8 manual votes on every subject criterion: 9 each.
    await rate(other, cse, ada, [10, 10, 10, 5, 5, 5]);
    for (const criterion of SUBJECT) await setManualVotes(admin, cse, null, criterion, 1, 8);

    expect(await subjectStats(student, cse)).toMatchObject({
      difficulty: null,
      exam_level: null,
      interest: null,
      difficulty_votes: 9,
      votes: 9,
      enough_votes: false,
    });
    // An admin sees the averages anyway, with the flag saying students do not.
    const forAdmin = await subjectStats(admin, cse);
    expect(Number(forAdmin.difficulty)).toBe(2);
    expect(forAdmin.enough_votes).toBe(false);

    // The tenth vote is a student's own rating.
    await rate(student, cse, ada, [10, 10, 10, 5, 5, 5]);
    const shown = await subjectStats(student, cse);
    expect(shown).toMatchObject({ votes: 10, enough_votes: true });
    expect(Number(shown.difficulty)).toBeCloseTo(2.8);
    expect(Number(shown.exam_level)).toBeCloseTo(2.8);
    expect(Number(shown.interest)).toBeCloseTo(2.8);
  });

  it("hides a professor block with 9 votes from a non-admin and shows it with 10", async () => {
    for (const criterion of PROFESSOR) await setManualVotes(admin, cse, ada, criterion, 7, 9);

    expect(await professorStats(student, cse, ada)).toMatchObject({
      engagement: null,
      understanding: null,
      approachability: null,
      votes: 9,
      enough_votes: false,
    });
    expect(Number((await professorStats(admin, cse, ada))?.engagement)).toBe(7);

    for (const criterion of PROFESSOR) await setManualVotes(admin, cse, ada, criterion, 7, 10);
    const shown = await professorStats(student, cse, ada);
    expect(shown).toMatchObject({ votes: 10, enough_votes: true });
    expect(Number(shown?.engagement)).toBe(7);
  });

  it("keeps the whole block empty while one criterion is short", async () => {
    await setManualVotes(admin, cse, null, "difficulty", 5, 50);
    await setManualVotes(admin, cse, null, "exam_level", 5, 50);
    await setManualVotes(admin, cse, null, "interest", 5, 9);

    expect(await subjectStats(student, cse)).toMatchObject({
      difficulty: null,
      exam_level: null,
      interest: null,
      difficulty_votes: 50,
      interest_votes: 9,
      votes: 9,
      enough_votes: false,
    });
  });

  it("is decided per block: one professor of a course can be shown while another is not", async () => {
    for (const criterion of PROFESSOR) {
      await setManualVotes(admin, cse, ada, criterion, 8, 10);
      await setManualVotes(admin, cse, bob, criterion, 8, 9);
    }
    expect((await professorStats(student, cse, ada))?.enough_votes).toBe(true);
    expect(await professorStats(student, cse, bob)).toMatchObject({ engagement: null, enough_votes: false });
    expect(await subjectStats(student, cse)).toMatchObject({ difficulty: null, votes: 0 });
  });
});

describe("a hidden professor", () => {
  beforeEach(async () => {
    for (const criterion of PROFESSOR) await setManualVotes(admin, cse, bob, criterion, 9, 20);
    await rate(student, cse, bob, [5, 5, 5, 9, 9, 9]);
    await rows(admin, "update public.professors set hidden = true where id = $1", [bob]);
  });

  it("cannot be read by a non-admin: not the name, the course link or the ratings", async () => {
    expect(await rows(other, "select * from public.professors where id = $1", [bob])).toEqual([]);
    expect(await rows(other, "select * from public.course_professors where professor_id = $1", [bob])).toEqual([]);
    expect(await professorStats(other, cse, bob)).toBeUndefined();
    // Not even the user's own earlier rating of that professor.
    expect(await rows(student, "select * from public.professor_ratings")).toEqual([]);
    // The visible professor of the same course is unaffected.
    expect(await rows(other, "select name from public.professors where id = $1", [ada])).toEqual([{ name: "Ada" }]);
    expect(await professorStats(other, cse, ada)).toBeDefined();
  });

  it("cannot be rated, with the same answer as a professor who does not teach the course", async () => {
    await expect(rate(other, cse, bob, [5, 5, 5, 5, 5, 5])).rejects.toThrow(/does not teach/);
  });

  it("is still readable by an admin", async () => {
    expect(await rows(admin, "select name, hidden from public.professors where id = $1", [bob])).toEqual([
      { name: "Bob", hidden: true },
    ]);
    expect(await professorStats(admin, cse, bob)).toMatchObject({ hidden: true, votes: 21, enough_votes: true });
  });

  it("comes back with every vote when shown again", async () => {
    await rows(admin, "update public.professors set hidden = false where id = $1", [bob]);

    expect(await rows(other, "select name from public.professors where id = $1", [bob])).toEqual([{ name: "Bob" }]);
    const shown = await professorStats(other, cse, bob);
    expect(shown).toMatchObject({ hidden: false, votes: 21, enough_votes: true });
    expect(Number(shown?.engagement)).toBe(9);
    expect(await rows(student, "select professor_id from public.professor_ratings")).toEqual([{ professor_id: bob }]);
  });
});

describe("the site totals", () => {
  const totals = async (userId: string | null) => (await rows(userId, "select * from public.site_totals()"))[0];

  it("are three numbers that everyone reads, signed in or not", async () => {
    // Four accounts with a profile and two courses come from the setup above.
    const expected = { votes: 0, students: 4, courses: 2 };
    for (const reader of [null, student, admin]) {
      expect(await rows(reader, "select * from public.site_totals()")).toEqual([expected]);
    }
  });

  it("count a rating as one subject vote and one professor vote", async () => {
    await rate(student, cse, ada, [5, 5, 5, 5, 5, 5]);
    expect((await totals(null)).votes).toBe(2);

    // Rating again replaces the earlier rating: still two.
    await rate(student, cse, ada, [8, 8, 8, 8, 8, 8]);
    expect((await totals(null)).votes).toBe(2);

    // A second professor of the same course: one more professor vote, the same subject vote.
    await rate(student, cse, bob, [8, 8, 8, 6, 6, 6]);
    expect((await totals(null)).votes).toBe(3);

    await rate(aeStudent, ae, eve, [5, 5, 5, 5, 5, 5]);
    expect((await totals(null)).votes).toBe(5);
  });

  it("count manual votes as the course page does: the smallest of a block's three criteria", async () => {
    await setManualVotes(admin, cse, null, "difficulty", 5, 30);
    // Two criteria of the subject have no votes yet, so the block has none.
    expect((await totals(null)).votes).toBe(0);

    await setManualVotes(admin, cse, null, "exam_level", 5, 12);
    await setManualVotes(admin, cse, null, "interest", 5, 20);
    expect((await totals(null)).votes).toBe(12);
    expect((await subjectStats(student, cse)).votes).toBe(12);

    for (const criterion of PROFESSOR) await setManualVotes(admin, cse, ada, criterion, 7, 10);
    await rate(student, cse, ada, [5, 5, 5, 5, 5, 5]);
    // 12 + 1 for the subject, 10 + 1 for Ada.
    expect((await totals(null)).votes).toBe(24);
  });

  it("leave out the votes of a hidden professor, and count them again when shown", async () => {
    for (const criterion of PROFESSOR) await setManualVotes(admin, cse, bob, criterion, 9, 20);
    await rate(student, cse, bob, [5, 5, 5, 9, 9, 9]);
    expect((await totals(null)).votes).toBe(22);

    await rows(admin, "update public.professors set hidden = true where id = $1", [bob]);
    // The subject vote stays. An admin gets the same number: it is what the site shows.
    expect((await totals(null)).votes).toBe(1);
    expect((await totals(admin)).votes).toBe(1);

    await rows(admin, "update public.professors set hidden = false where id = $1", [bob]);
    expect((await totals(null)).votes).toBe(22);
  });

  it("count a student once they have a profile, and every course", async () => {
    // An account that has not finished registering.
    await db.query("insert into auth.users default values");
    expect((await totals(null)).students).toBe(4);

    await createUser(db, { programme: "CSE" });
    await db.query("insert into public.courses (code, name, programme_id, year) values ('CSE2', 'Logic', 'CSE', 1)");
    expect(await totals(null)).toEqual({ votes: 0, students: 5, courses: 3 });
  });

  it("open nothing else to a signed-out visitor", async () => {
    await rate(student, cse, ada, [5, 5, 5, 5, 5, 5]);
    for (const hidden of ["private.subject_stats", "private.professor_stats", "public.profiles", "public.subject_ratings"]) {
      await expect(rows(null, `select * from ${hidden}`), hidden).rejects.toThrow(/permission denied/);
    }
  });
});

describe("the calendar scores", () => {
  const scores = (userId: string | null) => rows(userId, "select * from public.calendar_scores() order by code");

  // Ten votes (the minimum) on each criterion of a block, at the given values.
  async function subjectVotes(course: string, values: number[], count = 10) {
    for (const [i, criterion] of SUBJECT.entries()) await setManualVotes(admin, course, null, criterion, values[i], count);
  }
  async function professorVotes(course: string, professor: string, values: number[], count = 10) {
    for (const [i, criterion] of PROFESSOR.entries()) {
      await setManualVotes(admin, course, professor, criterion, values[i], count);
    }
  }

  // What the score module makes of the stats a student receives: the numbers of the
  // course's own page. calendar_scores() has to give exactly these.
  async function pageNumbers(course: string) {
    const number = (v: unknown) => (v === null ? null : Number(v));
    const s = await subjectStats(student, course);
    const subject: SubjectStats = {
      difficulty: number(s.difficulty),
      exam_level: number(s.exam_level),
      interest: number(s.interest),
      enough_votes: s.enough_votes as boolean,
    };
    const blocks = await rows(student, "select * from public.course_professor_stats($1)", [course]);
    const candidates: ProfessorStats[] = blocks.map((row) => ({
      professor_id: row.professor_id as string,
      hidden: row.hidden as boolean,
      engagement: number(row.engagement),
      understanding: number(row.understanding),
      approachability: number(row.approachability),
      votes: row.votes as number,
      enough_votes: row.enough_votes as boolean,
    }));
    const best = defaultProfessor(candidates);
    return {
      score: courseScore(subject, candidates)?.score ?? null,
      load: subject.enough_votes ? load(subject as SubjectAverages) : null,
      teach: best ? teach(best as ProfessorAverages) : null,
    };
  }

  it("are three numbers per course that everyone reads, signed in or not", async () => {
    await subjectVotes(cse, [7, 8, 6]);
    await professorVotes(cse, ada, [9, 9, 9]);

    const expected = [{ code: "CSE1", score: 0.65 * 7.5 + 0.23 * (10 - 9) + 0.12 * (10 - 6), load: 7.5, teach: 9 }];
    // An admin gets no more than anyone else: these are the numbers the site shows.
    for (const reader of [null, student, aeStudent, admin]) {
      expect(await scores(reader)).toEqual(expected);
    }
  });

  it("leave out a course nobody rated", async () => {
    expect(await scores(null)).toEqual([]);
  });

  it("show nothing of a block that is below the minimum", async () => {
    await subjectVotes(cse, [7, 8, 6], 9);
    await professorVotes(cse, ada, [9, 9, 9], 9);
    expect(await scores(null)).toEqual([]);
    expect(await scores(admin)).toEqual([]);

    // The subject reaches the minimum: its load shows. The score needs the professor too.
    await subjectVotes(cse, [7, 8, 6]);
    expect(await scores(null)).toEqual([{ code: "CSE1", score: null, load: 7.5, teach: null }]);

    // One criterion of the professor stays one vote short.
    await setManualVotes(admin, cse, ada, "engagement", 9, 10);
    await setManualVotes(admin, cse, ada, "understanding", 9, 10);
    expect((await scores(null))[0]).toMatchObject({ score: null, teach: null });

    await setManualVotes(admin, cse, ada, "approachability", 9, 10);
    expect((await scores(null))[0]).toMatchObject({ load: 7.5, teach: 9 });
    expect((await scores(null))[0].score).not.toBeNull();
  });

  it("show the teaching score alone while the subject is below the minimum", async () => {
    await professorVotes(ae, eve, [8, 7, 9]);
    expect(await scores(null)).toEqual([{ code: "AE1", score: null, load: null, teach: 8 }]);
  });

  it("use the best rated professor, and never a hidden one", async () => {
    await subjectVotes(cse, [7, 8, 6]);
    await professorVotes(cse, ada, [9, 9, 9]);
    await professorVotes(cse, bob, [6, 6, 6], 40);
    expect((await scores(null))[0].teach).toBe(9);

    await rows(admin, "update public.professors set hidden = true where id = $1", [ada]);
    for (const reader of [null, student, admin]) {
      expect((await scores(reader))[0]).toEqual({ code: "CSE1", ...(await pageNumbers(cse)) });
      expect((await scores(reader))[0].teach).toBe(6);
    }

    // With every professor hidden only the load is left.
    await rows(admin, "update public.professors set hidden = true where id = $1", [bob]);
    expect(await scores(null)).toEqual([{ code: "CSE1", score: null, load: 7.5, teach: null }]);
  });

  it("pick between equally rated professors as the course page does: more votes, then the lower id", async () => {
    await subjectVotes(cse, [7, 8, 6]);
    // The same teaching score from different votes: 8 three times, and 7, 8 and 9.
    await professorVotes(cse, ada, [8, 8, 8], 12);
    await professorVotes(cse, bob, [7, 8, 9], 30);
    expect(await scores(null)).toEqual([{ code: "CSE1", ...(await pageNumbers(cse)) }]);

    await professorVotes(cse, ada, [8, 8, 8], 30);
    expect(await scores(null)).toEqual([{ code: "CSE1", ...(await pageNumbers(cse)) }]);
  });

  it("are the numbers of the course's own page, to the last digit", async () => {
    // Votes chosen to be awkward for a computer, as [value, number of votes] per criterion.
    // The first gives a score of exactly 5.25 (load 7, teaching 8, interest 8), which one
    // way of calculating shows as 5.2 and another as 5.3. The others give averages that do
    // not end, such as 7.333...
    const cases: { subject: [number, number][][]; professor: [number, number][][] }[] = [
      {
        subject: [[[7, 5], [8, 5]], [[6, 5], [7, 5]], [[8, 10]]],
        professor: [[[8, 10]], [[8, 10]], [[8, 10]]],
      },
      {
        subject: [[[7, 10], [8, 5]], [[6, 11], [9, 3]], [[5, 7], [8, 6]]],
        professor: [[[9, 10], [7, 4]], [[8, 13]], [[6, 9], [10, 2], [7, 3]]],
      },
      {
        subject: [[[1, 3], [10, 8]], [[0, 10], [9, 1]], [[3, 6], [4, 7]]],
        professor: [[[8, 7], [9, 6]], [[2, 1], [9, 12]], [[7, 11], [8, 2]]],
      },
    ];
    for (const votes of cases) {
      await db.query("delete from public.manual_votes");
      for (const [i, criterion] of SUBJECT.entries()) {
        for (const [value, count] of votes.subject[i]) await setManualVotes(admin, cse, null, criterion, value, count);
      }
      for (const [i, criterion] of PROFESSOR.entries()) {
        for (const [value, count] of votes.professor[i]) await setManualVotes(admin, cse, ada, criterion, value, count);
      }
      const page = await pageNumbers(cse);
      expect(page.score).not.toBeNull();
      expect(await scores(null)).toEqual([{ code: "CSE1", ...page }]);
    }
    // The last case was not rounded on the way: its teaching score is a number without end.
    expect(String((await scores(null))[0].teach).length).toBeGreaterThan(12);
  });

  it("count student ratings together with manual votes", async () => {
    await subjectVotes(cse, [7, 8, 6], 9);
    await professorVotes(cse, ada, [9, 9, 9], 9);
    await rate(student, cse, ada, [2, 3, 10, 4, 5, 6]);
    expect(await scores(null)).toEqual([{ code: "CSE1", ...(await pageNumbers(cse)) }]);
    // Difficulty (9 * 7 + 2) / 10 = 6.5 and exam level (9 * 8 + 3) / 10 = 7.5.
    expect((await scores(null))[0].load).toBe(7);
  });

  it("leave the criteria, the vote counts and the professors closed to a signed-out visitor", async () => {
    await subjectVotes(cse, [7, 8, 6]);
    await professorVotes(cse, ada, [9, 9, 9]);
    for (const hidden of [
      "public.course_subject_stats()",
      "public.course_professor_stats()",
      "private.subject_stats",
      "private.professor_stats",
      "public.manual_votes",
      "public.professors",
    ]) {
      await expect(rows(null, `select * from ${hidden}`), hidden).rejects.toThrow(/permission denied/);
    }
  });
});

describe("something a later migration adds", () => {
  it("is closed to the API roles until that migration grants access", async () => {
    await db.exec(`
      create table public.later_table (id int);
      create function public.later_function() returns int language sql security definer return 1;
    `);
    for (const user of [null, student]) {
      await expect(rows(user, "select * from public.later_table")).rejects.toThrow(/permission denied/);
      await expect(rows(user, "select public.later_function()")).rejects.toThrow(/permission denied/);
    }
  });
});

describe("the seed data", () => {
  let seeded: PGlite;
  let seedStudent: string;
  let seedAdmin: string;

  beforeAll(async () => {
    seeded = await createTestDatabase({ seed: true });
    seedStudent = await createUser(seeded, { programme: "CSE" });
    seedAdmin = await createUser(seeded, { programme: "AE", admin: true });
  });

  afterAll(async () => {
    await seeded.close();
  });

  // Reads the stats as the given user and runs them through the score module, the way a
  // page does. Returns what each course card would show, by course code.
  async function cards(userId: string) {
    const read = (sql: string) => as(seeded, userId, (tx) => tx.query<Row>(sql)).then((r) => r.rows);
    const number = (v: unknown) => (v === null ? null : Number(v));
    // Only the example courses: the curriculum courses in the seed have no votes.
    const courses = await read("select id, code from public.courses where id::text like '00000000-0000-4000-a000-%'");
    const professors = await read("select id, name from public.professors");
    const subjects = await read("select * from public.course_subject_stats()");
    const blocks = await read("select * from public.course_professor_stats()");

    return Object.fromEntries(
      courses.map((course) => {
        const s = subjects.find((row) => row.course_id === course.id)!;
        const subject: SubjectStats = {
          difficulty: number(s.difficulty),
          exam_level: number(s.exam_level),
          interest: number(s.interest),
          enough_votes: s.enough_votes as boolean,
        };
        const candidates: ProfessorStats[] = blocks
          .filter((row) => row.course_id === course.id)
          .map((row) => ({
            professor_id: row.professor_id as string,
            hidden: row.hidden as boolean,
            engagement: number(row.engagement),
            understanding: number(row.understanding),
            approachability: number(row.approachability),
            votes: row.votes as number,
            enough_votes: row.enough_votes as boolean,
          }));
        const result = courseScore(subject, candidates);
        return [
          course.code as string,
          result && {
            professor: professors.find((p) => p.id === result.professor_id)?.name,
            load: result.load.toFixed(1),
            teach: result.teach.toFixed(1),
            score: result.score.toFixed(1),
            verdict: VERDICT_LABELS[result.verdict],
          },
        ];
      }),
    );
  }

  const EXPECTED = {
    // Two professors with enough votes: the best rated one is used.
    CSE1001: { professor: "Dr. Marijke van Houten", load: "7.4", teach: "9.2", score: "5.4", verdict: "Smooth ride" },
    CSE1002: { professor: "Prof. Ravi Menon", load: "8.0", teach: "8.8", score: "5.6", verdict: "Hard, but well taught" },
    CSE2001: null, // subject one vote short
    CSE2002: null, // only professor has 6 votes
    AE2001: { professor: "Dr. Anouk Dekkers", load: "8.1", teach: "9.0", score: "5.6", verdict: "Hard, but well taught" },
    // The better rated professor is hidden, so the visible one is used.
    AE3001: { professor: "Prof. Tomasz Wieliczko", load: "9.3", teach: "6.8", score: "6.9", verdict: "Brace yourself" },
    AE1001: null, // no votes
  };

  it("gives a student the demo's numbers through the score module", async () => {
    expect(await cards(seedStudent)).toEqual(EXPECTED);
  });

  it("gives a signed-out visitor the same numbers in the calendar", async () => {
    const found = await as(seeded, null, (tx) => tx.query<Row>("select * from public.calendar_scores()"));
    const shown = Object.fromEntries(found.rows.map((row) => [row.code as string, row]));
    for (const [code, card] of Object.entries(EXPECTED)) {
      const row = shown[code];
      if (card) {
        expect(
          { load: (row.load as number).toFixed(1), teach: (row.teach as number).toFixed(1), score: (row.score as number).toFixed(1) },
          code,
        ).toEqual({ load: card.load, teach: card.teach, score: card.score });
      } else {
        // No combined score: the course is left out, or shows only one of the small circles.
        expect(row?.score ?? null, code).toBeNull();
      }
    }
    // The curriculum courses in the seed have no votes.
    expect(Object.keys(shown).sort()).toEqual(["AE2001", "AE3001", "CSE1001", "CSE1002", "CSE2001", "CSE2002"]);
  });

  it("holds the curriculum of both programmes, every course with its quarters", async () => {
    const perYear = await as(seeded, null, (tx) =>
      tx.query<Row>(
        `select programme_id, year, count(*)::int as courses from public.courses
         where quarters <> '{}' group by programme_id, year order by programme_id, year`,
      ),
    );
    expect(perYear.rows).toEqual([
      { programme_id: "AE", year: 1, courses: 15 },
      { programme_id: "AE", year: 2, courses: 17 },
      { programme_id: "AE", year: 3, courses: 5 },
      { programme_id: "CSE", year: 1, courses: 12 },
      { programme_id: "CSE", year: 2, courses: 8 },
      { programme_id: "CSE", year: 3, courses: 1 },
    ]);
  });

  it("links the study guide lecturers to their first-year CSE courses", async () => {
    const linked = await as(seeded, seedStudent, (tx) =>
      tx.query<Row>(
        `select c.code, array_agg(p.name order by p.name) as lecturers
         from public.course_professors l
         join public.courses c on c.id = l.course_id
         join public.professors p on p.id = l.professor_id
         where c.code in ('CSE11C', 'CSE12C', 'CSE11B') group by c.code order by c.code`,
      ),
    );
    expect(linked.rows).toEqual([
      { code: "CSE11C", lecturers: ["A. Asadi PhD", "Dr. A.J. Power"] },
      { code: "CSE12C", lecturers: ["Dr. A.J. Power"] },
    ]);
  });

  it("gives an admin the same published scores, although an admin receives more rows", async () => {
    expect(await cards(seedAdmin)).toEqual(EXPECTED);
  });

  it("hides the hidden professor from the student", async () => {
    const names = await as(seeded, seedStudent, (tx) => tx.query<Row>("select name from public.professors"));
    // 7 visible example professors and the 9 lecturers of the first-year CSE courses.
    expect(names.rows).toHaveLength(16);
    expect(names.rows).not.toContainEqual({ name: "Dr. Hiroshi Tanabe" });
  });

  it("skips an example course whose code is already taken, instead of failing", async () => {
    const taken = await createTestDatabase();
    await taken.query("insert into public.courses (code, name, programme_id, year) values ('CSE1001', 'The real one', 'CSE', 1)");
    await taken.exec(readFileSync(join(import.meta.dirname, "seed.sql"), "utf8"));

    const { rows: found } = await taken.query<Row>(
      "select (select count(*) from public.courses)::int as courses, (select name from public.courses where code = 'CSE1001') as name, (select count(*) from public.manual_votes m join public.courses c on c.id = m.course_id where c.code = 'CSE1001')::int as votes",
    );
    // 7 example courses (one of them skipped, the real one counted) and 58 from the curriculum.
    expect(found).toEqual([{ courses: 65, name: "The real one", votes: 0 }]);
    await taken.close();
  });

  it("gives its lecturers to its own courses only, not to a real course with the same code", async () => {
    const taken = await createTestDatabase();
    await taken.query("insert into public.courses (code, name, programme_id, year) values ('CSE11C', 'The real one', 'CSE', 1)");
    await taken.exec(readFileSync(join(import.meta.dirname, "seed.sql"), "utf8"));

    const { rows: found } = await taken.query<Row>(
      `select c.code, c.name, count(l.professor_id)::int as lecturers
       from public.courses c left join public.course_professors l on l.course_id = c.id
       where c.code in ('CSE11C', 'CSE12C') group by c.code, c.name order by c.code`,
    );
    expect(found).toEqual([
      { code: "CSE11C", name: "The real one", lecturers: 0 },
      { code: "CSE12C", name: "Data Management", lecturers: 1 },
    ]);
    await taken.close();
  });

  it("can be loaded twice without adding anything", async () => {
    const count = () => seeded.query<Row>("select (select count(*) from public.manual_votes)::int as votes, (select count(*) from public.courses)::int as courses, (select count(*) from public.course_professors)::int as links");
    const before = (await count()).rows;
    await seeded.exec(readFileSync(join(import.meta.dirname, "seed.sql"), "utf8"));
    expect((await count()).rows).toEqual(before);
  });
});

// A throwaway Postgres for tests, built from the real migration files.
//
// PGlite is Postgres compiled to run inside Node, so the tests need no Docker and no
// Supabase project. The prelude below recreates the parts of a Supabase project the
// migrations rely on: the API roles, auth.users and auth.uid().
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite, type Transaction } from "@electric-sql/pglite";

const SUPABASE_DIR = join(import.meta.dirname, "..");

// Like a Supabase project, new tables and functions in public start out open to the API
// roles. The migrations have to close them, and the tests prove that they do.
const PRELUDE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique
  );
  create function auth.uid() returns uuid language sql stable as $$
    select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid;
  $$;

  grant usage on schema auth, public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export function migrationFiles(): string[] {
  const dir = join(SUPABASE_DIR, "migrations");
  return readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .map((name) => join(dir, name));
}

export async function createTestDatabase(options: { seed?: boolean } = {}): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(PRELUDE);
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(file, "utf8"));
  }
  if (options.seed) {
    await db.exec(readFileSync(join(SUPABASE_DIR, "seed.sql"), "utf8"));
  }
  return db;
}

// Runs `run` the way the API would for this caller: as the signed-in user with this id, or
// as a signed-out visitor when the id is null. Changes are kept when `run` succeeds and
// rolled back when it throws.
export async function as<T>(
  db: PGlite,
  userId: string | null,
  run: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${userId ? "authenticated" : "anon"}`);
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      userId ? JSON.stringify({ sub: userId, role: "authenticated" }) : "",
    ]);
    return run(tx);
  });
}

// Creates an account with a profile, as the owner of the database (no access rules apply).
export async function createUser(
  db: PGlite,
  user: { programme: "AE" | "CSE"; year?: number; admin?: boolean },
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    "insert into auth.users default values returning id",
  );
  const id = rows[0].id;
  await db.query(
    "insert into public.profiles (id, programme_id, year, is_admin) values ($1, $2, $3, $4)",
    [id, user.programme, user.year ?? 1, user.admin ?? false],
  );
  return id;
}

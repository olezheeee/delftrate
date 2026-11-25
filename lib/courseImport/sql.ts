// Builds the SQL that writes the validated course data into the database.
// This file is also run directly by Node's type stripping, so it uses only erasable
// TypeScript, and the import below is type-only (it is erased).
import type { Course } from "./schema";

// The first dollar-quote tag, starting from `base`, that does not occur in the text, also
// not across its end (text ending in "$base" followed by the closing tag would end early).
function freeTag(text: string, base: string): string {
  let tag = base;
  for (let n = 1; `${text}$`.includes(`$${tag}$`); n++) tag = `${base}_${n}`;
  return tag;
}

// Wraps text in a dollar-quoted literal. Nothing inside a dollar-quoted literal is an
// escape, so the text arrives exactly as written whatever the server's string settings.
export function dollarQuote(text: string): string {
  const tag = freeTag(text, "import_json");
  return `$${tag}$${text}$${tag}$`;
}

// Every (course code, professor name) pair in the data.
const LINKS = `select c.code, p.name
    from jsonb_to_recordset(v_doc) as c(code text, professors jsonb),
         jsonb_array_elements_text(c.professors) as p(name)`;

// The rows sent to the database: exactly the fields the import writes. Quarters are sorted
// here (not only by the validator), because the "unchanged course" check below compares
// the stored list in order: [2, 1] and [1, 2] would otherwise count as a change every run.
export function importRows(courses: Course[]) {
  return courses.map((c) => ({
    code: c.code,
    name: c.name,
    programme: c.programme,
    year: c.year,
    professors: c.professors,
    quarters: [...c.quarters].sort((a, b) => a - b),
  }));
}

// The import is ONE statement: a do block. `supabase db query --file` sends a file as a
// single prepared statement, which may hold only one command, and a single statement is
// all or nothing by itself, so no begin/commit is needed.
// It never deletes or hides anything. It adds and updates only.
// It needs the quarters column (migration 20261126000002_course_quarters.sql) on the target.
export function importSql(courses: Course[]): string {
  const literal = dollarQuote(JSON.stringify(importRows(courses)));

  const body = `
declare
  v_doc jsonb := ${literal}::jsonb;
  clash text;
  near text;
begin
  -- Nobody else may add or rename professors until this import is done, so the guard
  -- below stays true while the rows are written.
  lock table public.professors in share row exclusive mode;

  -- 1. Guard: stop, and change nothing, if a name in the files matches more than one
  -- professor, or matches a professor whose name differs only in capitals or spaces (that
  -- would quietly create a second row for the same person).
  select string_agg(format('%L (%s rows)', n.name, n.total), ', ' order by n.name)
    into clash
  from (
    select p.name, count(*) as total
    from public.professors p
    where p.name in (select l.name from (${LINKS}) l)
    group by p.name
    having count(*) > 1
  ) n;
  if clash is not null then
    raise exception 'Import stopped, nothing was changed. These professor names match more than one existing professor: %. Merge or rename the duplicates first.', clash;
  end if;

  select string_agg(distinct format('%L in the files, %L in the database', l.name, p.name), ', ')
    into near
  from (${LINKS}) l
  join public.professors p
    on lower(regexp_replace(btrim(p.name), '[[:space:]]+', ' ', 'g')) = lower(l.name)
   and p.name <> l.name;
  if near is not null then
    raise exception 'Import stopped, nothing was changed. These professor names differ only in capitals or spaces from a professor in the database: %. Write them the same way.', near;
  end if;

  -- 2. Courses: matched on code, updated in place so the id and its ratings stay. A course
  -- whose data did not change is not touched.
  -- jsonb_to_recordset reads the JSON array of quarters straight into smallint[].
  insert into public.courses as c (code, name, programme_id, year, quarters)
  select d.code, d.name, d.programme, d.year, d.quarters
  from jsonb_to_recordset(v_doc)
    as d(code text, name text, programme text, year smallint, quarters smallint[])
  on conflict (code) do update
    set name = excluded.name,
        programme_id = excluded.programme_id,
        year = excluded.year,
        quarters = excluded.quarters
    where (c.name, c.programme_id, c.year, c.quarters)
      is distinct from (excluded.name, excluded.programme_id, excluded.year, excluded.quarters);

  -- 3. Professors: matched on exact name, created once when missing.
  insert into public.professors (name)
  select distinct l.name from (${LINKS}) l
  where not exists (select 1 from public.professors p where p.name = l.name);

  -- 4. Links: existing ones are left alone.
  insert into public.course_professors (course_id, professor_id)
  select distinct c.id, p.id
  from (${LINKS}) l
  join public.courses c on c.code = l.code
  join public.professors p on p.name = l.name
  on conflict do nothing;
end
`;
  const tag = freeTag(body, "import");
  return `do $${tag}$${body}$${tag}$;\n`;
}

// Run after the import, as its own statement: the totals in the database now.
export const TOTALS_SQL = `select
  (select count(*) from public.courses) as courses,
  (select count(*) from public.professors) as professors,
  (select count(*) from public.course_professors) as course_professors;
`;

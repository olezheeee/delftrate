// Builds the SQL script that writes the validated course data into the database.
// This file is also run directly by Node's type stripping, so it uses only erasable
// TypeScript, and the import below is type-only (it is erased).
import type { Course } from "./schema";

// Wraps text in a dollar-quoted literal. Nothing inside a dollar-quoted literal is an
// escape, so the text arrives exactly as written whatever the server's string settings.
// The tag is chosen so that it does not occur in the text, also not across the end of the
// text (text ending in "$import_json" followed by the closing tag would end it early).
export function dollarQuote(text: string): string {
  let tag = "import_json";
  for (let n = 1; `${text}$`.includes(`$${tag}$`); n++) tag = `import_json_${n}`;
  return `$${tag}$${text}$${tag}$`;
}

// The script never deletes or hides anything. It adds and updates only.
export function importSql(courses: Course[]): string {
  const literal = dollarQuote(
    JSON.stringify(
      courses.map((c) => ({
        code: c.code,
        name: c.name,
        programme: c.programme,
        year: c.year,
        professors: c.professors,
        // Quarters would be added here once the courses table has the column (Pack 4).
      })),
    ),
  );

  return `begin;

-- Nobody else may add or rename professors until this import commits, so the guard
-- below stays true while the rows are written.
lock table public.professors in share row exclusive mode;

create temp table import_courses on commit drop as
  select code, name, programme, year, professors
  from jsonb_to_recordset(${literal}::jsonb)
    as c(code text, name text, programme text, year smallint, professors jsonb);

create temp table import_links on commit drop as
  select c.code, p.name
  from import_courses c, jsonb_array_elements_text(c.professors) as p(name);

-- 1. Guard: stop, and change nothing, if a name in the files matches more than one
-- professor, or matches a professor whose name differs only in capitals or spaces (that
-- would quietly create a second row for the same person).
do $$
declare
  clash text;
  near text;
begin
  select string_agg(format('%L (%s rows)', n.name, n.total), ', ' order by n.name)
    into clash
  from (
    select p.name, count(*) as total
    from public.professors p
    where p.name in (select name from import_links)
    group by p.name
    having count(*) > 1
  ) n;
  if clash is not null then
    raise exception 'Import stopped, nothing was changed. These professor names match more than one existing professor: %. Merge or rename the duplicates first.', clash;
  end if;

  select string_agg(distinct format('%L in the files, %L in the database', l.name, p.name), ', ')
    into near
  from import_links l
  join public.professors p
    on lower(regexp_replace(btrim(p.name), '[[:space:]]+', ' ', 'g')) = lower(l.name)
   and p.name <> l.name;
  if near is not null then
    raise exception 'Import stopped, nothing was changed. These professor names differ only in capitals or spaces from a professor in the database: %. Write them the same way.', near;
  end if;
end
$$;

-- 2. Courses: matched on code, updated in place so the id and its ratings stay. A course
-- whose data did not change is not touched.
-- Quarters would be written here once the courses table has the column (Pack 4).
insert into public.courses as c (code, name, programme_id, year)
select code, name, programme, year from import_courses
on conflict (code) do update
  set name = excluded.name,
      programme_id = excluded.programme_id,
      year = excluded.year
  where (c.name, c.programme_id, c.year)
    is distinct from (excluded.name, excluded.programme_id, excluded.year);

-- 3. Professors: matched on exact name, created once when missing.
insert into public.professors (name)
select distinct l.name from import_links l
where not exists (select 1 from public.professors p where p.name = l.name);

-- 4. Links: existing ones are left alone.
insert into public.course_professors (course_id, professor_id)
select distinct c.id, p.id
from import_links l
join public.courses c on c.code = l.code
join public.professors p on p.name = l.name
on conflict do nothing;

commit;

-- 5. Totals in the database now.
select
  (select count(*) from public.courses) as courses,
  (select count(*) from public.professors) as professors,
  (select count(*) from public.course_professors) as course_professors;
`;
}

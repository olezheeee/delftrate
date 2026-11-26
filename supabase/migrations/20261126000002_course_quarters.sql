-- DelftRate schema, part 6: the quarters a course runs in, and a public course list.
--
-- The home page shows a calendar of courses per quarter. So every course says when it runs,
-- and signed-out visitors can read the course list: code, name, programme, year and
-- quarters, all of which TU Delft publishes in its study guide.

-- A list of quarters: each one 1, 2, 3 or 4 and none twice. The empty list is allowed and
-- means "not known yet".
create function private.is_quarter_list(q smallint[]) returns boolean
language sql immutable
set search_path = ''
return
  q is not null
  -- One plain list. '{{1,2},{3,4}}' would pass the checks below, which see its elements
  -- flattened; the empty list has no dimensions at all.
  and coalesce(array_ndims(q), 1) = 1
  -- A null element is not contained in the list on the right, so it is refused here.
  and q <@ array[1, 2, 3, 4]::smallint[]
  and cardinality(q) = (select count(distinct x) from unnest(q) as x);

-- A check on a table runs with the rights of whoever writes the row: an admin through the
-- API (authenticated) or a server job with the service key (service_role). Without execute
-- on the helper every write to courses would fail. The private schema itself stays closed
-- to them: the check holds the function directly, not by name.
grant execute on function private.is_quarter_list(smallint[]) to authenticated, service_role;

-- Courses that exist already get the empty list; the course import fills it in.
alter table public.courses
  add column quarters smallint[] not null default '{}'
  constraint courses_quarters_valid check (private.is_quarter_list(quarters));

-- Signed-out visitors read courses and nothing else. Professors, the links between courses
-- and professors, ratings, votes, profiles and the averages stay closed to them, and
-- writing courses stays with admins.
grant select on public.courses to anon;

create policy "Anyone can read courses"
  on public.courses for select
  to anon
  using (true);

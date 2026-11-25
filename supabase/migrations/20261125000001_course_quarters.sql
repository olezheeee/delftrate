-- DelftRate schema, part 4: the quarters a course runs in, and a public course list.
-- The home page shows a calendar of courses per quarter, so every course needs to say when
-- it runs, and signed-out visitors need to read the course list (the codes and names are
-- public in the TU Delft study guide).

-- A list of quarters: each one 1, 2, 3 or 4, none twice, none empty. The empty list is fine.
create function private.is_quarter_list(q smallint[]) returns boolean
language sql immutable
set search_path = ''
return
  q is not null
  -- A plain list: '{{1,2},{3,4}}' would pass the checks below, which see the elements
  -- flattened. The empty list has no dimensions.
  and coalesce(array_ndims(q), 1) = 1
  and q <@ array[1, 2, 3, 4]::smallint[]
  -- A null element is not contained in the list above, and count(distinct) skips nulls.
  and cardinality(q) = (select count(distinct x) from unnest(q) as x);

-- The check runs with the rights of whoever writes to courses: an admin through the API
-- (authenticated) or a server job with the service key (service_role). Both need execute on
-- the helper, or every write to courses fails. They do not need usage on the private
-- schema: the check refers to the function directly, not by name, so the schema stays
-- closed to the API roles.
grant execute on function private.is_quarter_list(smallint[]) to authenticated, service_role;

-- A course can run over several quarters. Empty means not known yet: existing courses get
-- it, and the course import fills it in later.
alter table public.courses
  add column quarters smallint[] not null default '{}'
  constraint courses_quarters_valid check (private.is_quarter_list(quarters));

-- Signed-out visitors read courses and nothing else: professors, links, ratings, votes,
-- profiles and the averages stay closed to them. Writing stays with admins.
grant select on public.courses to anon;

create policy "Anyone can read courses"
  on public.courses for select
  to anon
  using (true);

-- DelftRate schema, part 7: signed-out visitors read five columns of a course, not the row.
--
-- Part 6 opened the course list to signed-out visitors for the calendar on the home page,
-- and meant the five things the calendar shows: code, name, programme, year and quarters.
-- Its grant covered the whole table, so the internal id and the creation time of every
-- course could be read as well. This narrows it to the five columns.
--
-- A signed-out request has to name its columns from now on: "select *" is refused.
-- Signed-in users are not affected.
revoke select on public.courses from anon;

grant select (code, name, programme_id, year, quarters) on public.courses to anon;

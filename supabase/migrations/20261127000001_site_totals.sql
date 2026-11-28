-- DelftRate schema, part 8: three totals for the bar at the top of the home page.
--
-- The home page is public and shows how much is on the site: votes, registered students and
-- courses. Signed-out visitors read no ratings, votes or profiles here: this function hands
-- out three numbers and nothing else. (Part 9 opens three ratings per course to them.)
--
--   votes     every vote the course pages count: for each course its subject votes, plus the
--             votes of each of its professors who is not hidden. Student ratings and manual
--             votes together, as in the averages. A block counts as the course page shows
--             it: the smallest of its three criteria.
--   students  accounts that finished registering (they have a profile)
--   courses   courses on the site
--
-- A hidden professor's votes are left out, like everything else about a hidden professor.
--
-- Security definer: it reads tables its callers may not read, and returns only the counts.
create function public.site_totals()
returns table (votes integer, students integer, courses integer)
language sql stable security definer
set search_path = ''
as $$
  select
    (
      (select coalesce(sum(least(s.difficulty_votes, s.exam_level_votes, s.interest_votes)), 0)
         from private.subject_stats s)
      + (select coalesce(sum(least(p.engagement_votes, p.understanding_votes, p.approachability_votes)), 0)
           from private.professor_stats p
          where not p.hidden)
    )::integer,
    (select count(*) from public.profiles)::integer,
    (select count(*) from public.courses)::integer;
$$;
grant execute on function public.site_totals() to anon, authenticated;

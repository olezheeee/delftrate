-- DelftRate schema, part 9: the ratings in the calendar on the home page, for everyone.
--
-- The calendar shows three numbers next to each course: the combined score, the subject's
-- load, and the teaching score of the course's default professor. Until now every rating
-- needed an account. Oleg decided on 28 November 2026 that these three are shown to
-- everyone, signed in or not.
--
-- What this hands to a signed-out visitor is those three numbers per course code. It
-- hands out no vote count and no professor's id or name, and the two stats functions stay
-- closed. Know what the three numbers carry with them, though:
--   - the score is a fixed sum of teach, interest and load (below), so whoever has all
--     three can work out the course's interest average as well;
--   - the numbers are not rounded (below), and an average such as 7.333... tells a little
--     about how many votes are behind it.
-- Every one of them is an average of at least min_votes() votes, never one student's
-- rating. The rules are those of course_subject_stats() and course_professor_stats(): a
-- block counts only once each of its criteria has min_votes() votes, and a hidden
-- professor never counts. An admin gets the same rows as everyone: these are the numbers
-- the site shows.
--
-- The numbers are worked out here and not on the page, because whatever this function
-- hands out is public. They have to be the numbers of the course's own page, which
-- lib/score.ts works out from the averages, to the last digit: 6.85 must not become 6.8 in
-- one place and 6.9 in the other. So this does what lib/score.ts does, step by step and in
-- the same kind of number (double precision, which is what JavaScript calculates with):
--   load   (difficulty + exam level) / 2
--   teach  (engagement + understanding + approachability) / 3
--   score  0.6 * teach + 0.25 * interest + 0.15 * (10 - load)
-- and it picks the default professor the same way: the highest teach (compared after
-- rounding to six decimals), then the most votes, then the lowest id.
-- The database tests compare the two on the same votes. Change them together.
--
-- A course is left out until it has at least one of the numbers.
-- Security definer: it reads all ratings to average them and hands out only the result.
create function public.calendar_scores()
returns table (
  code text,
  score double precision,
  load double precision,
  teach double precision
)
language sql stable security definer
set search_path = ''
as $$
  with subject as (
    select
      s.course_id,
      (s.difficulty::double precision + s.exam_level::double precision) / 2 as load,
      s.interest::double precision as interest
    from private.subject_stats s
    where least(s.difficulty_votes, s.exam_level_votes, s.interest_votes) >= public.min_votes()
  ),
  professor as (
    select
      p.course_id,
      p.professor_id,
      least(p.engagement_votes, p.understanding_votes, p.approachability_votes) as votes,
      (p.engagement::double precision + p.understanding::double precision
        + p.approachability::double precision) / 3 as teach
    from private.professor_stats p
    where not p.hidden
      and least(p.engagement_votes, p.understanding_votes, p.approachability_votes) >= public.min_votes()
  ),
  best as (
    select distinct on (p.course_id) p.course_id, p.teach
    from professor p
    order by
      p.course_id,
      floor(p.teach * 1000000 + 0.5::double precision) desc,
      p.votes desc,
      p.professor_id
  )
  select
    c.code,
    0.6::double precision * b.teach
      + 0.25::double precision * s.interest
      + 0.15::double precision * (10 - s.load),
    s.load,
    b.teach
  from public.courses c
  left join subject s on s.course_id = c.id
  left join best b on b.course_id = c.id
  where s.course_id is not null or b.course_id is not null;
$$;
grant execute on function public.calendar_scores() to anon, authenticated;

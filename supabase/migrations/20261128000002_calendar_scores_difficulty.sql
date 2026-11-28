-- DelftRate schema, part 10: the score in the calendar becomes the overall difficulty.
--
-- Oleg decided on 28 November 2026 that the single rating of a course says how hard the
-- course is: low for the easiest course, 10 for one that is impossible to pass. Before, it
-- was a mark where higher was better. The new sum, as in lib/score.ts (combinedScore):
--   score  0.65 * load + 0.23 * (10 - teach) + 0.12 * (10 - interest)
-- The load counts for 65%, the teaching for 23% and interest for 12%; good teaching and an
-- interesting subject make a course easier, so those two count the other way round.
--
-- Nothing else about calendar_scores() changes: who may call it, which rows it returns,
-- the load, the teaching score and the choice of the default professor are those of part
-- 9, and so is the rule that it works the numbers out step by step as lib/score.ts does.
-- Change them together.
create or replace function public.calendar_scores()
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
    0.65::double precision * s.load
      + 0.23::double precision * (10 - b.teach)
      + 0.12::double precision * (10 - s.interest),
    s.load,
    b.teach
  from public.courses c
  left join subject s on s.course_id = c.id
  left join best b on b.course_id = c.id
  where s.course_id is not null or b.course_id is not null;
$$;
grant execute on function public.calendar_scores() to anon, authenticated;

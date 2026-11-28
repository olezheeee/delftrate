-- DelftRate schema, part 12: the ranks of one course.
--
-- The course page shows three rank tiles: how hard the course is among all courses, how
-- many rated courses have a lighter load, and where the professor's teaching stands. Until
-- now the page read the averages of every course and every professor to work these out
-- itself, on every view, and lost the tiles once there were more rows than the API hands
-- out in one request. course_ranks() works them out here and returns only the ranks.
--
-- The rules are the ones the page applied:
--   - A hidden professor never counts, and neither does a block (the subject of a course,
--     or one professor on a course) below min_votes().
--   - The difficulty of a course is the sum of lib/score.ts (combinedScore), worked out
--     step by step in double precision as calendar_scores() does. Change them together.
--   - This course is ranked once with each of its own professors; every other course
--     counts with its default professor (the best rated one; with equal ratings the one
--     with more votes, then the lower id), as in calendar_scores().
--   - Rank 1 is the highest value: the hardest course, the best teaching. Equal values
--     share a rank. Two values are equal when they agree to six decimals, so that float
--     noise never decides a rank (tidy() in lib/score.ts).
--
-- One row per professor of the course who is not hidden, and one row with an empty
-- professor_id for a course without such a professor. No row for a course that does not
-- exist.
--   score_rank, score_of    the course's difficulty with this professor among all courses
--                           that have a difficulty; empty while the subject or this
--                           professor has too few votes
--   teach_rank, teach_of    this professor's teaching on this course among every professor
--                           of every course with enough votes; empty with too few votes
--   lighter_load            whole percentage of the other courses with enough subject
--                           votes whose load is lower; the same in every row; empty while
--                           this course has too few subject votes or no other course counts
--
-- Security definer: it reads all ratings to rank them and hands out only ranks and counts,
-- never an average or a vote. An admin gets the same as a student. Only signed-in users
-- may call it, like the other course statistics.
create function public.course_ranks(p_course_id uuid)
returns table (
  professor_id uuid,
  score_rank integer,
  score_of integer,
  teach_rank integer,
  teach_of integer,
  lighter_load integer
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
  ),
  -- The difficulty of every other course, to six decimals.
  other_scores as (
    select
      floor((0.65::double precision * s.load
        + 0.23::double precision * (10 - b.teach)
        + 0.12::double precision * (10 - s.interest)) * 1000000 + 0.5::double precision) as score
    from subject s
    join best b on b.course_id = s.course_id
    where s.course_id <> p_course_id
  ),
  -- This course's professors who are not hidden, each with the two values to rank. Both
  -- are empty while the professor has too few votes, the score also while the subject has.
  mine as (
    select
      cp.professor_id,
      floor(p.teach * 1000000 + 0.5::double precision) as teach,
      floor((0.65::double precision * s.load
        + 0.23::double precision * (10 - p.teach)
        + 0.12::double precision * (10 - s.interest)) * 1000000 + 0.5::double precision) as score
    from public.course_professors cp
    join public.professors pr on pr.id = cp.professor_id and not pr.hidden
    left join professor p on p.course_id = cp.course_id and p.professor_id = cp.professor_id
    left join subject s on s.course_id = cp.course_id
    where cp.course_id = p_course_id
  ),
  lighter as (
    select
      case when count(*) > 0 then
        floor((100 * count(*) filter (
          where floor(o.load * 1000000 + 0.5::double precision)
            < floor(own.load * 1000000 + 0.5::double precision)
        ))::double precision / count(*) + 0.5::double precision)::integer
      end as share
    from subject own
    join subject o on o.course_id <> own.course_id
    where own.course_id = p_course_id
  )
  select
    m.professor_id,
    case when m.score is not null then
      (1 + (select count(*) from other_scores o where o.score > m.score))::integer
    end,
    case when m.score is not null then (1 + (select count(*) from other_scores))::integer end,
    case when m.teach is not null then
      (1 + (
        select count(*)
        from professor q
        where floor(q.teach * 1000000 + 0.5::double precision) > m.teach
      ))::integer
    end,
    case when m.teach is not null then (select count(*) from professor)::integer end,
    (select share from lighter)
  from public.courses c
  left join mine m on true
  where c.id = p_course_id;
$$;
grant execute on function public.course_ranks(uuid) to authenticated;

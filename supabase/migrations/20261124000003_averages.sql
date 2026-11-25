-- DelftRate schema, part 3: averages and the minimum number of votes.
--
-- Student ratings and manual votes count together, one vote each.
-- A "block" is the three subject criteria of a course, or the three criteria of one
-- professor on a course. For everyone except admins the averages of a block stay empty
-- until every criterion in it has reached min_votes(). The vote counts are always returned.

-- The one place the minimum is defined. Pages show what the functions below return; they
-- do not apply a threshold of their own.
create function public.min_votes() returns integer
language sql immutable
set search_path = ''
return 10;
grant execute on function public.min_votes() to anon, authenticated;

-- Every subject vote as (course, criterion, value, number of votes).
create view private.subject_votes as
  select course_id, 'difficulty'::public.criterion as criterion, difficulty as value, 1 as n
    from public.subject_ratings
  union all
  select course_id, 'exam_level', exam_level, 1 from public.subject_ratings
  union all
  select course_id, 'interest', interest, 1 from public.subject_ratings
  union all
  select course_id, criterion, value, count
    from public.manual_votes
    where professor_id is null;

-- Every professor vote as (course, professor, criterion, value, number of votes).
create view private.professor_votes as
  select course_id, professor_id, 'engagement'::public.criterion as criterion,
         engagement as value, 1 as n
    from public.professor_ratings
  union all
  select course_id, professor_id, 'understanding', understanding, 1
    from public.professor_ratings
  union all
  select course_id, professor_id, 'approachability', approachability, 1
    from public.professor_ratings
  union all
  select course_id, professor_id, criterion, value, count
    from public.manual_votes
    where professor_id is not null;

-- One row per course, also for a course without votes.
create view private.subject_stats as
  select
    c.id as course_id,
    sum(v.value * v.n) filter (where v.criterion = 'difficulty')
      / nullif(sum(v.n) filter (where v.criterion = 'difficulty'), 0) as difficulty,
    sum(v.value * v.n) filter (where v.criterion = 'exam_level')
      / nullif(sum(v.n) filter (where v.criterion = 'exam_level'), 0) as exam_level,
    sum(v.value * v.n) filter (where v.criterion = 'interest')
      / nullif(sum(v.n) filter (where v.criterion = 'interest'), 0) as interest,
    coalesce(sum(v.n) filter (where v.criterion = 'difficulty'), 0)::integer as difficulty_votes,
    coalesce(sum(v.n) filter (where v.criterion = 'exam_level'), 0)::integer as exam_level_votes,
    coalesce(sum(v.n) filter (where v.criterion = 'interest'), 0)::integer as interest_votes
  from public.courses c
  left join private.subject_votes v on v.course_id = c.id
  group by c.id;

-- One row per professor of a course, also for one without votes.
create view private.professor_stats as
  select
    cp.course_id,
    cp.professor_id,
    p.hidden,
    sum(v.value * v.n) filter (where v.criterion = 'engagement')
      / nullif(sum(v.n) filter (where v.criterion = 'engagement'), 0) as engagement,
    sum(v.value * v.n) filter (where v.criterion = 'understanding')
      / nullif(sum(v.n) filter (where v.criterion = 'understanding'), 0) as understanding,
    sum(v.value * v.n) filter (where v.criterion = 'approachability')
      / nullif(sum(v.n) filter (where v.criterion = 'approachability'), 0) as approachability,
    coalesce(sum(v.n) filter (where v.criterion = 'engagement'), 0)::integer as engagement_votes,
    coalesce(sum(v.n) filter (where v.criterion = 'understanding'), 0)::integer as understanding_votes,
    coalesce(sum(v.n) filter (where v.criterion = 'approachability'), 0)::integer as approachability_votes
  from public.course_professors cp
  join public.professors p on p.id = cp.professor_id
  left join private.professor_votes v
    on v.course_id = cp.course_id and v.professor_id = cp.professor_id
  group by cp.course_id, cp.professor_id, p.hidden;

-- Subject averages and vote counts: for one course, or for every course when p_course_id
-- is left out.
--   votes         the smallest of the three counts: the number that decides the minimum
--   enough_votes  true once every criterion has reached min_votes()
-- The three averages are null while enough_votes is false, unless the caller is an admin.
-- Security definer: it reads all ratings to average them and hands out only the averages.
create function public.course_subject_stats(p_course_id uuid default null)
returns table (
  course_id uuid,
  difficulty numeric,
  exam_level numeric,
  interest numeric,
  difficulty_votes integer,
  exam_level_votes integer,
  interest_votes integer,
  votes integer,
  enough_votes boolean
)
language sql stable security definer
set search_path = ''
as $$
  with caller as (select public.is_admin() as is_admin),
  blocks as (
    select
      s.*,
      least(s.difficulty_votes, s.exam_level_votes, s.interest_votes) as block_votes
    from private.subject_stats s
    where p_course_id is null or s.course_id = p_course_id
  )
  select
    b.course_id,
    case when caller.is_admin or b.block_votes >= public.min_votes() then b.difficulty end,
    case when caller.is_admin or b.block_votes >= public.min_votes() then b.exam_level end,
    case when caller.is_admin or b.block_votes >= public.min_votes() then b.interest end,
    b.difficulty_votes,
    b.exam_level_votes,
    b.interest_votes,
    b.block_votes,
    b.block_votes >= public.min_votes()
  from blocks b, caller;
$$;
grant execute on function public.course_subject_stats(uuid) to authenticated;

-- Professor averages and vote counts: for the professors of one course, or of every course
-- when p_course_id is left out.
-- Same rules as course_subject_stats(). Rows of hidden professors are returned to admins
-- only; the hidden column tells an admin which ones those are.
create function public.course_professor_stats(p_course_id uuid default null)
returns table (
  course_id uuid,
  professor_id uuid,
  hidden boolean,
  engagement numeric,
  understanding numeric,
  approachability numeric,
  engagement_votes integer,
  understanding_votes integer,
  approachability_votes integer,
  votes integer,
  enough_votes boolean
)
language sql stable security definer
set search_path = ''
as $$
  with caller as (select public.is_admin() as is_admin),
  blocks as (
    select
      s.*,
      least(s.engagement_votes, s.understanding_votes, s.approachability_votes) as block_votes
    from private.professor_stats s
    where p_course_id is null or s.course_id = p_course_id
  )
  select
    b.course_id,
    b.professor_id,
    b.hidden,
    case when caller.is_admin or b.block_votes >= public.min_votes() then b.engagement end,
    case when caller.is_admin or b.block_votes >= public.min_votes() then b.understanding end,
    case when caller.is_admin or b.block_votes >= public.min_votes() then b.approachability end,
    b.engagement_votes,
    b.understanding_votes,
    b.approachability_votes,
    b.block_votes,
    b.block_votes >= public.min_votes()
  from blocks b, caller
  where caller.is_admin or not b.hidden;
$$;
grant execute on function public.course_professor_stats(uuid) to authenticated;

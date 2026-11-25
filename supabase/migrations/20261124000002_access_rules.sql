-- DelftRate schema, part 2: who may read and write what.
--
-- In short:
--   * signed-out visitors read nothing except the list of programmes
--   * signed-in users read courses, professors (not hidden ones) and their own ratings
--   * a rating is written only through submit_rating(): own rating, own programme, all six
--     values at once
--   * manual votes and their change log are for admins only
--   * averages are read through the functions in the next migration

-- True for a signed-in user whose profile has the admin flag.
-- Security definer so the policies on profiles can use it without reading profiles through
-- themselves.
create function public.is_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = (select auth.uid())),
    false
  );
$$;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Programmes: two public names, also needed by the registration form before sign-in.
-- ---------------------------------------------------------------------------
grant select on public.programmes to anon, authenticated;

create policy "Anyone can read programmes"
  on public.programmes for select
  to anon, authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Profiles: a user sees and creates only their own. The admin flag cannot be set through
-- the API at all, and the programme cannot be changed after it is chosen, because the
-- programme decides which courses the user may rate.
-- ---------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant insert (id, programme_id, year) on public.profiles to authenticated;
grant update (year) on public.profiles to authenticated;

create policy "Users read their own profile, admins read all"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));

create policy "Users create their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy "Users update their own profile"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Courses, professors and their links: signed-in users read, admins write.
-- A hidden professor, and every link to one, is visible to admins only.
-- ---------------------------------------------------------------------------
grant select, insert, update, delete
  on public.courses, public.professors, public.course_professors
  to authenticated;

create policy "Signed-in users read courses"
  on public.courses for select
  to authenticated
  using (true);

create policy "Signed-in users read professors who are not hidden"
  on public.professors for select
  to authenticated
  using (not hidden or (select public.is_admin()));

-- The professors policy above applies inside this subquery, so a link to a hidden
-- professor disappears together with the professor.
create policy "Signed-in users read links to visible professors"
  on public.course_professors for select
  to authenticated
  using (exists (select 1 from public.professors p where p.id = professor_id));

create policy "Admins add courses" on public.courses for insert
  to authenticated with check ((select public.is_admin()));
create policy "Admins change courses" on public.courses for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove courses" on public.courses for delete
  to authenticated using ((select public.is_admin()));

create policy "Admins add professors" on public.professors for insert
  to authenticated with check ((select public.is_admin()));
create policy "Admins change professors" on public.professors for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins remove professors" on public.professors for delete
  to authenticated using ((select public.is_admin()));

create policy "Admins add course links" on public.course_professors for insert
  to authenticated with check ((select public.is_admin()));
create policy "Admins remove course links" on public.course_professors for delete
  to authenticated using ((select public.is_admin()));

-- ---------------------------------------------------------------------------
-- Ratings: a user reads only their own rows. Nobody, admins included, reads another
-- user's individual ratings. There is no insert, update or delete privilege: writing goes
-- through submit_rating().
-- ---------------------------------------------------------------------------
grant select on public.subject_ratings, public.professor_ratings to authenticated;

create policy "Users read their own subject ratings"
  on public.subject_ratings for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "Users read their own professor ratings"
  on public.professor_ratings for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and exists (select 1 from public.professors p where p.id = professor_id)
  );

-- Saves one complete rating: the three subject values and the three values for one
-- professor of the course. Rating again replaces the earlier values; it never adds a
-- second vote. Everything is saved in one step, or nothing is.
create function public.submit_rating(
  p_course_id uuid,
  p_professor_id uuid,
  p_difficulty numeric,
  p_exam_level numeric,
  p_interest numeric,
  p_engagement numeric,
  p_understanding numeric,
  p_approachability numeric
) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_values numeric[] := array[
    p_difficulty, p_exam_level, p_interest,
    p_engagement, p_understanding, p_approachability
  ];
begin
  if v_user is null then
    raise exception 'Sign in to rate a course.' using errcode = '42501';
  end if;

  if p_course_id is null or p_professor_id is null
     or array_position(v_values, null) is not null then
    raise exception 'A rating needs a course, a professor and all six values.'
      using errcode = '23502';
  end if;

  if exists (select 1 from unnest(v_values) as v where not private.is_rating_value(v)) then
    raise exception 'Every value must be between 0 and 10, in steps of 0.5.'
      using errcode = '23514';
  end if;

  if not exists (
    select 1
    from public.courses c
    join public.profiles u on u.programme_id = c.programme_id
    where c.id = p_course_id and u.id = v_user
  ) then
    raise exception 'You can rate only courses of your own programme.'
      using errcode = '42501';
  end if;

  -- A hidden professor gets the same answer as one who does not teach the course, so the
  -- message does not reveal that the professor exists.
  if not exists (
    select 1
    from public.course_professors cp
    join public.professors pr on pr.id = cp.professor_id
    where cp.course_id = p_course_id
      and cp.professor_id = p_professor_id
      and not pr.hidden
  ) then
    raise exception 'This professor does not teach this course.' using errcode = '23503';
  end if;

  insert into public.subject_ratings as r
    (user_id, course_id, difficulty, exam_level, interest)
  values
    (v_user, p_course_id, p_difficulty, p_exam_level, p_interest)
  on conflict (user_id, course_id) do update set
    difficulty = excluded.difficulty,
    exam_level = excluded.exam_level,
    interest = excluded.interest,
    updated_at = now();

  insert into public.professor_ratings as r
    (user_id, course_id, professor_id, engagement, understanding, approachability)
  values
    (v_user, p_course_id, p_professor_id, p_engagement, p_understanding, p_approachability)
  on conflict (user_id, course_id, professor_id) do update set
    engagement = excluded.engagement,
    understanding = excluded.understanding,
    approachability = excluded.approachability,
    updated_at = now();
end;
$$;
grant execute on function public.submit_rating(uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric)
  to authenticated;

-- ---------------------------------------------------------------------------
-- Manual votes and their change log: admins only.
-- An admin may add a row and overwrite its count, nothing else. The log is read-only.
-- ---------------------------------------------------------------------------
grant select, insert on public.manual_votes to authenticated;
grant update (count) on public.manual_votes to authenticated;
grant select on public.manual_vote_changes to authenticated;

create policy "Admins read manual votes" on public.manual_votes for select
  to authenticated using ((select public.is_admin()));
create policy "Admins add manual votes" on public.manual_votes for insert
  to authenticated with check ((select public.is_admin()));
create policy "Admins change manual votes" on public.manual_votes for update
  to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "Admins read the manual vote change log" on public.manual_vote_changes for select
  to authenticated using ((select public.is_admin()));

-- Sets the number of manual votes of one value for one criterion, overwriting what was
-- stored. p_professor_id is required for the three professor criteria and left out for the
-- three subject criteria. Runs with the caller's rights: the policies above decide.
create function public.set_manual_votes(
  p_course_id uuid,
  p_criterion public.criterion,
  p_value smallint,
  p_count smallint,
  p_professor_id uuid default null
) returns void
language sql
set search_path = ''
as $$
  insert into public.manual_votes as m (course_id, professor_id, criterion, value, count)
  values (p_course_id, p_professor_id, p_criterion, p_value, p_count)
  on conflict on constraint manual_votes_one_count_per_value
  do update set count = excluded.count;
$$;
grant execute on function public.set_manual_votes(uuid, public.criterion, smallint, smallint, uuid)
  to authenticated;

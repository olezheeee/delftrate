-- DelftRate schema, part 1: the tables.
-- Who may read and write them is in the next migration; until it runs, nothing here is
-- reachable through the API (row level security is switched on at the end of this file).

-- Functions and views that must never be callable through the API live here.
create schema private;
revoke all on schema private from public;

-- A rating value: 0 to 10 in steps of 0.5.
create function private.is_rating_value(v numeric) returns boolean
language sql immutable
set search_path = ''
return v between 0 and 10 and v * 2 = trunc(v * 2);

-- ---------------------------------------------------------------------------
-- Programmes. Users pick a programme, not a faculty.
-- ---------------------------------------------------------------------------
create table public.programmes (
  id text primary key check (id ~ '^[A-Z]{2,6}$'),
  name text not null unique
);

insert into public.programmes (id, name) values
  ('AE', 'Aerospace Engineering'),
  ('CSE', 'Computer Science and Engineering');

-- ---------------------------------------------------------------------------
-- Profiles: one per user.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  programme_id text not null references public.programmes (id),
  year smallint not null check (year between 1 and 5),
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);
create index profiles_programme_id_idx on public.profiles (programme_id);

-- ---------------------------------------------------------------------------
-- Professors, courses and the links between them.
-- ---------------------------------------------------------------------------
create table public.professors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (btrim(name) <> ''),
  -- Switched on and off by an admin. Hidden means students see neither the name nor the
  -- ratings; the votes stay, so showing the professor again brings everything back.
  hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (btrim(code) <> ''),
  name text not null check (btrim(name) <> ''),
  programme_id text not null references public.programmes (id),
  year smallint not null check (year between 1 and 5),
  created_at timestamptz not null default now()
);
create index courses_programme_id_idx on public.courses (programme_id);

-- A course can have several professors.
create table public.course_professors (
  course_id uuid not null references public.courses (id) on delete cascade,
  professor_id uuid not null references public.professors (id) on delete cascade,
  primary key (course_id, professor_id)
);
create index course_professors_professor_id_idx on public.course_professors (professor_id);

-- ---------------------------------------------------------------------------
-- Student ratings.
-- A rating is six values: three about the subject, three about one professor of the course.
-- Users have no direct write access to these tables. The only way in is submit_rating()
-- (next migration), which saves all six values in one step or none of them.
-- ---------------------------------------------------------------------------

-- One per user per course.
create table public.subject_ratings (
  user_id uuid not null references public.profiles (id) on delete cascade,
  course_id uuid not null references public.courses (id) on delete cascade,
  difficulty numeric(3, 1) not null check (private.is_rating_value(difficulty)),
  exam_level numeric(3, 1) not null check (private.is_rating_value(exam_level)),
  interest numeric(3, 1) not null check (private.is_rating_value(interest)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id)
);
create index subject_ratings_course_id_idx on public.subject_ratings (course_id);

-- One per user per course and professor. It cannot exist without the same user's subject
-- rating for the course.
create table public.professor_ratings (
  user_id uuid not null,
  course_id uuid not null,
  professor_id uuid not null,
  engagement numeric(3, 1) not null check (private.is_rating_value(engagement)),
  understanding numeric(3, 1) not null check (private.is_rating_value(understanding)),
  approachability numeric(3, 1) not null check (private.is_rating_value(approachability)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, course_id, professor_id),
  foreign key (user_id, course_id)
    references public.subject_ratings (user_id, course_id) on delete cascade,
  foreign key (course_id, professor_id)
    references public.course_professors (course_id, professor_id) on delete cascade
);
create index professor_ratings_course_professor_idx
  on public.professor_ratings (course_id, professor_id);

-- ---------------------------------------------------------------------------
-- Manual votes: votes collected in person, entered by an admin.
-- One row holds how many votes of one whole value (0 to 10) a criterion has. The count is
-- a number that gets overwritten, not a history of additions; the history is in the log.
-- ---------------------------------------------------------------------------
create type public.criterion as enum (
  'difficulty', 'exam_level', 'interest',
  'engagement', 'understanding', 'approachability'
);

create table public.manual_votes (
  id bigint generated always as identity primary key,
  course_id uuid not null references public.courses (id) on delete cascade,
  -- Set for the three professor criteria, empty for the three subject criteria.
  professor_id uuid,
  criterion public.criterion not null,
  value smallint not null check (value between 0 and 10),
  count smallint not null check (count between 0 and 50),
  foreign key (course_id, professor_id)
    references public.course_professors (course_id, professor_id) on delete cascade,
  constraint manual_votes_professor_matches_criterion check (
    (criterion in ('engagement', 'understanding', 'approachability')) = (professor_id is not null)
  ),
  constraint manual_votes_one_count_per_value
    unique nulls not distinct (course_id, professor_id, criterion, value)
);

-- Who changed which count, when, from what to what. Written by a trigger only.
-- The course and the professor are plain ids on purpose: the log outlives them, so removing
-- a course or a professor does not erase the record of who entered votes for it.
create table public.manual_vote_changes (
  id bigint generated always as identity primary key,
  changed_by uuid references public.profiles (id) on delete set null,
  changed_at timestamptz not null default now(),
  course_id uuid not null,
  professor_id uuid,
  criterion public.criterion not null,
  value smallint not null,
  old_count smallint not null,
  new_count smallint not null
);
create index manual_vote_changes_course_id_idx on public.manual_vote_changes (course_id);
create index manual_vote_changes_professor_id_idx on public.manual_vote_changes (professor_id);
create index manual_vote_changes_changed_at_idx on public.manual_vote_changes (changed_at desc);

create function private.log_manual_vote_change() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  -- A row that disappears (its course, or the professor's link to it, was removed) is
  -- logged as a change to zero.
  v_row public.manual_votes := case when tg_op = 'DELETE' then old else new end;
  v_old smallint := case when tg_op = 'INSERT' then 0 else old.count end;
  v_new smallint := case when tg_op = 'DELETE' then 0 else new.count end;
begin
  if v_new <> v_old then
    insert into public.manual_vote_changes
      (changed_by, course_id, professor_id, criterion, value, old_count, new_count)
    values
      ((select auth.uid()), v_row.course_id, v_row.professor_id, v_row.criterion, v_row.value,
       v_old, v_new);
  end if;
  return null;
end;
$$;

create trigger manual_votes_log_change
  after insert or update or delete on public.manual_votes
  for each row execute function private.log_manual_vote_change();

-- ---------------------------------------------------------------------------
-- Closed by default: row level security on every table, and no privileges for API roles
-- beyond what the next migration grants one by one.
-- ---------------------------------------------------------------------------
alter table public.programmes enable row level security;
alter table public.profiles enable row level security;
alter table public.professors enable row level security;
alter table public.courses enable row level security;
alter table public.course_professors enable row level security;
alter table public.subject_ratings enable row level security;
alter table public.professor_ratings enable row level security;
alter table public.manual_votes enable row level security;
alter table public.manual_vote_changes enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- The same for everything a later migration adds. A Supabase project hands every new
-- table, sequence and function in public to the API roles; from here on a migration has to
-- grant access explicitly, and forgetting to do so leaves the new object closed, not open.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, authenticated;
alter default privileges revoke execute on functions from public;

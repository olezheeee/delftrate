-- Small fictional data set for the development project, so the other packs have something
-- to show before the real course import (Pack 3). Never load this into production.
--
-- It holds no users. Every vote here is a manual vote, which needs no account, so the
-- averages work on a project where nobody has registered yet.
-- Safe to run twice: rows that already exist are left alone. An example course whose code
-- is already taken by a real course is skipped, together with its links and votes.
--
-- What to expect when signed in as a student:
--   CSE1001  two professors with enough votes; van Houten is the best rated one
--   CSE1002  one professor, enough votes
--   CSE2001  subject has 9 votes: no subject averages, so no combined score
--   CSE2002  subject has enough votes, its only professor has 6: no combined score
--   AE2001   one professor, enough votes
--   AE3001   one visible professor, and one hidden professor with better ratings who must
--            not appear anywhere and must not be used for the combined score
--   AE1001   no votes at all

insert into public.professors (id, name, hidden) values
  ('00000000-0000-4000-a000-000000000101', 'Dr. Marijke van Houten', false),
  ('00000000-0000-4000-a000-000000000102', 'Prof. Ravi Menon', false),
  ('00000000-0000-4000-a000-000000000103', 'Dr. Anouk Dekkers', false),
  ('00000000-0000-4000-a000-000000000104', 'Prof. Tomasz Wieliczko', false),
  ('00000000-0000-4000-a000-000000000105', 'Dr. Chiara Bellandi', false),
  ('00000000-0000-4000-a000-000000000106', 'Dr. Pieter Lindeboom', false),
  ('00000000-0000-4000-a000-000000000107', 'Dr. Hiroshi Tanabe', true),
  ('00000000-0000-4000-a000-000000000108', 'Dr. Leila Haddadi', false)
on conflict (id) do nothing;

insert into public.courses (id, code, name, programme_id, year) values
  ('00000000-0000-4000-a000-000000000201', 'CSE1001', 'Calculus for Engineers', 'CSE', 1),
  ('00000000-0000-4000-a000-000000000202', 'CSE1002', 'Algorithms and Data Structures', 'CSE', 1),
  ('00000000-0000-4000-a000-000000000203', 'CSE2001', 'Control Systems', 'CSE', 2),
  ('00000000-0000-4000-a000-000000000204', 'CSE2002', 'Systems Modelling', 'CSE', 2),
  ('00000000-0000-4000-a000-000000000205', 'AE2001', 'Aerodynamics I', 'AE', 2),
  ('00000000-0000-4000-a000-000000000206', 'AE3001', 'Orbital Mechanics', 'AE', 3),
  ('00000000-0000-4000-a000-000000000207', 'AE1001', 'Thermodynamics', 'AE', 1)
on conflict do nothing;

insert into public.course_professors (course_id, professor_id)
select l.course_id, l.professor_id
from (values
  ('00000000-0000-4000-a000-000000000201'::uuid, '00000000-0000-4000-a000-000000000101'::uuid),
  ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000106'),
  ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000102'),
  ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000105'),
  ('00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000108'),
  ('00000000-0000-4000-a000-000000000205', '00000000-0000-4000-a000-000000000103'),
  ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000104'),
  ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000107'),
  ('00000000-0000-4000-a000-000000000207', '00000000-0000-4000-a000-000000000106')
) as l (course_id, professor_id)
where exists (select 1 from public.courses c where c.id = l.course_id)
  and exists (select 1 from public.professors p where p.id = l.professor_id)
on conflict do nothing;

-- Each line is one criterion: its target average and its number of votes. The votes are
-- split over the two whole values around the target, so that their average is the target
-- (7.2 with 20 votes becomes 16 votes of 7 and 4 votes of 8).
with targets (course_id, professor_id, criterion, average, votes) as (
  values
    -- CSE1001 Calculus for Engineers: subject, van Houten, Lindeboom
    ('00000000-0000-4000-a000-000000000201'::uuid, null::uuid, 'difficulty'::public.criterion, 7.2, 20),
    ('00000000-0000-4000-a000-000000000201', null, 'exam_level', 7.6, 20),
    ('00000000-0000-4000-a000-000000000201', null, 'interest', 7.0, 20),
    ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000101', 'engagement', 9.1, 20),
    ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000101', 'understanding', 9.6, 20),
    ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000101', 'approachability', 8.9, 20),
    ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000106', 'engagement', 7.0, 20),
    ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000106', 'understanding', 7.5, 20),
    ('00000000-0000-4000-a000-000000000201', '00000000-0000-4000-a000-000000000106', 'approachability', 7.1, 20),
    -- CSE1002 Algorithms and Data Structures: subject, Menon
    ('00000000-0000-4000-a000-000000000202', null, 'difficulty', 7.8, 20),
    ('00000000-0000-4000-a000-000000000202', null, 'exam_level', 8.2, 20),
    ('00000000-0000-4000-a000-000000000202', null, 'interest', 8.8, 20),
    ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000102', 'engagement', 9.2, 20),
    ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000102', 'understanding', 8.8, 20),
    ('00000000-0000-4000-a000-000000000202', '00000000-0000-4000-a000-000000000102', 'approachability', 8.3, 20),
    -- CSE2001 Control Systems: subject one vote short on interest, Bellandi
    ('00000000-0000-4000-a000-000000000203', null, 'difficulty', 8.0, 10),
    ('00000000-0000-4000-a000-000000000203', null, 'exam_level', 7.7, 10),
    ('00000000-0000-4000-a000-000000000203', null, 'interest', 8.0, 9),
    ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000105', 'engagement', 9.0, 20),
    ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000105', 'understanding', 9.1, 20),
    ('00000000-0000-4000-a000-000000000203', '00000000-0000-4000-a000-000000000105', 'approachability', 8.8, 20),
    -- CSE2002 Systems Modelling: subject, Haddadi with too few votes
    ('00000000-0000-4000-a000-000000000204', null, 'difficulty', 5.8, 20),
    ('00000000-0000-4000-a000-000000000204', null, 'exam_level', 6.1, 20),
    ('00000000-0000-4000-a000-000000000204', null, 'interest', 7.2, 20),
    ('00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000108', 'engagement', 9.5, 6),
    ('00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000108', 'understanding', 9.5, 6),
    ('00000000-0000-4000-a000-000000000204', '00000000-0000-4000-a000-000000000108', 'approachability', 9.5, 6),
    -- AE2001 Aerodynamics I: subject, Dekkers
    ('00000000-0000-4000-a000-000000000205', null, 'difficulty', 8.1, 20),
    ('00000000-0000-4000-a000-000000000205', null, 'exam_level', 8.0, 20),
    ('00000000-0000-4000-a000-000000000205', null, 'interest', 9.2, 20),
    ('00000000-0000-4000-a000-000000000205', '00000000-0000-4000-a000-000000000103', 'engagement', 9.0, 20),
    ('00000000-0000-4000-a000-000000000205', '00000000-0000-4000-a000-000000000103', 'understanding', 9.3, 20),
    ('00000000-0000-4000-a000-000000000205', '00000000-0000-4000-a000-000000000103', 'approachability', 8.7, 20),
    -- AE3001 Orbital Mechanics: subject, Wieliczko, Tanabe (hidden)
    ('00000000-0000-4000-a000-000000000206', null, 'difficulty', 9.1, 20),
    ('00000000-0000-4000-a000-000000000206', null, 'exam_level', 9.4, 20),
    ('00000000-0000-4000-a000-000000000206', null, 'interest', 8.6, 20),
    ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000104', 'engagement', 7.4, 20),
    ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000104', 'understanding', 6.3, 20),
    ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000104', 'approachability', 6.6, 20),
    ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000107', 'engagement', 9.0, 20),
    ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000107', 'understanding', 9.0, 20),
    ('00000000-0000-4000-a000-000000000206', '00000000-0000-4000-a000-000000000107', 'approachability', 9.0, 20)
),
split as (
  select
    t.*,
    floor(t.average)::smallint as low,
    round((t.average - floor(t.average)) * t.votes)::smallint as high_votes
  from targets t
  where exists (select 1 from public.courses c where c.id = t.course_id)
    and (
      t.professor_id is null
      or exists (
        select 1 from public.course_professors cp
        where cp.course_id = t.course_id and cp.professor_id = t.professor_id
      )
    )
)
insert into public.manual_votes (course_id, professor_id, criterion, value, count)
select course_id, professor_id, criterion, low, (votes - high_votes)::smallint
  from split
union all
select course_id, professor_id, criterion, (low + 1)::smallint, high_votes
  from split
  where high_votes > 0
on conflict do nothing;

-- The real curriculum, for the calendar on the home page: every bachelor course of the two
-- launch programmes with its year and quarters, as printed on the curriculum sheets
-- (BSc CSE 2026-2027 new curriculum; AE modules and courses, July 2022). No professors and
-- no votes: those come with the course import (Pack 3), which also replaces this list.
-- The AE sheet prints WI1421LR on both halves of Calculus I, so it is one course here.
-- The example courses above have no quarters and do not appear in the calendar.
insert into public.courses (code, name, programme_id, year, quarters) values
  ('AE1111-I', 'Exploring Aerospace Engineering', 'AE', 1, '{1,2}'),
  ('AE1111-II', 'Engineering Drawing', 'AE', 1, '{1,2}'),
  ('AE1222-I', 'Design & Construction', 'AE', 1, '{3,4}'),
  ('AE1222-II', 'Aerospace Design & Systems Engineering Elements I', 'AE', 1, '{3,4}'),
  ('AE1110-I', 'Introduction to Aerospace Engineering-I', 'AE', 1, '{1}'),
  ('AE1110-II', 'Introduction to Aerospace Engineering-II', 'AE', 1, '{2}'),
  ('AE1108-I', 'Aerospace Materials', 'AE', 1, '{2}'),
  ('AE1108-II', 'Aerospace Mechanics of Materials', 'AE', 1, '{3}'),
  ('AE1130-I', 'Statics', 'AE', 1, '{1}'),
  ('AE1130-II', 'Dynamics', 'AE', 1, '{2}'),
  ('AE1241', 'Physics', 'AE', 1, '{3,4}'),
  ('WI1421LR', 'Calculus I', 'AE', 1, '{1,2}'),
  ('WI1402LR', 'Calculus II', 'AE', 1, '{3}'),
  ('WI1403LR', 'Linear Algebra', 'AE', 1, '{4}'),
  ('AE1205', 'Programming & Scientific Computing in Python for AE1', 'AE', 1, '{4}'),
  ('AE2111-I', 'Systems Design', 'AE', 2, '{1,2}'),
  ('AE2111-II', 'Aerospace Design & Systems Engineering Elements II', 'AE', 2, '{1}'),
  ('AE2224-I', 'Test, Analysis & Simulation', 'AE', 2, '{3,4}'),
  ('AE2224-II', 'Artificial Intelligence for Aerospace Engineering', 'AE', 2, '{3}'),
  ('AE2130-I', 'Aerodynamics I', 'AE', 2, '{1}'),
  ('AE2130-II', 'Low-speed Wind Tunnel Test', 'AE', 2, '{2}'),
  ('AE2130-III', 'Aerodynamics II', 'AE', 2, '{2}'),
  ('AE2230-I', 'Flight & Orbital Mechanics', 'AE', 2, '{3}'),
  ('AE2230-II', 'Propulsion & Power', 'AE', 2, '{3}'),
  ('AE2135-I', 'Structural Analysis & Design', 'AE', 2, '{2}'),
  ('AE2135-II', 'Vibrations', 'AE', 2, '{2}'),
  ('AE2235-I', 'Aerospace Systems and Control Theory', 'AE', 2, '{4}'),
  ('AE2235-II', 'Signal Analysis and Telecommunication Principles', 'AE', 2, '{4}'),
  ('WI2180-I', 'Differential Equations', 'AE', 2, '{1}'),
  ('WI2180-II', 'Probability and Statistics', 'AE', 2, '{1}'),
  ('AE2220-I', 'Applied Numerical Analysis', 'AE', 2, '{3}'),
  ('AE2220-II', 'Computational Modelling', 'AE', 2, '{4}'),
  ('AE3211-I', 'Systems Engineering & Aerospace Design', 'AE', 3, '{3}'),
  ('AE3211-II', 'Production of Aerospace Systems', 'AE', 3, '{3}'),
  ('AE3212-I', 'Aerospace Flight Dynamics & Simulation, incl. Flight Test', 'AE', 3, '{3}'),
  ('AE3212-II', 'Simulation, Verification & Validation', 'AE', 3, '{3}'),
  ('AE3200', 'Design Synthesis', 'AE', 3, '{4}'),
  ('CSE11A', 'Reasoning and Logic', 'CSE', 1, '{1}'),
  ('CSE11B', 'Introduction to Programming', 'CSE', 1, '{1}'),
  ('CSE11C', 'Computer Organisation', 'CSE', 1, '{1}'),
  ('CSE12A', 'Calculus', 'CSE', 1, '{2}'),
  ('CSE12B', 'Human Computer Interaction & AI-Assisted Prototyping', 'CSE', 1, '{2}'),
  ('CSE12C', 'Data Management', 'CSE', 1, '{2}'),
  ('CSE13A', 'Linear Algebra', 'CSE', 1, '{3}'),
  ('CSE13B', 'Software Design and Engineering', 'CSE', 1, '{3}'),
  ('CSE13C', 'Algorithms and Data Structures', 'CSE', 1, '{3}'),
  ('CSE14A', 'Probability Theory and Statistics', 'CSE', 1, '{4}'),
  ('CSE14B', 'Computer Networks', 'CSE', 1, '{4}'),
  ('CSE100', 'Collaborative Development Project', 'CSE', 1, '{4}'),
  ('CSE21A', 'Introduction to AI', 'CSE', 2, '{1}'),
  ('CSE21B', 'Algorithm Design', 'CSE', 2, '{1}'),
  ('CSE21C', 'Operating Systems', 'CSE', 2, '{1}'),
  ('CSE22A', 'Machine Learning', 'CSE', 2, '{2}'),
  ('CSE22B', 'Theoretical Foundations of Computer Science', 'CSE', 2, '{2}'),
  ('CSE22C', 'Concepts of Programming Languages', 'CSE', 2, '{2}'),
  ('CSE23A', 'Computer Security', 'CSE', 2, '{3}'),
  ('CSE200', 'Software Project', 'CSE', 2, '{4}'),
  ('CSE300', 'Research Project', 'CSE', 3, '{4}')
on conflict (code) do nothing;

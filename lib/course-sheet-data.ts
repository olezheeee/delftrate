// Reads one course with its professors and averages, as the signed-in user. Uses the
// Supabase server client, so the component that calls it must sit inside <Suspense>.
import { ranksFromRows, type CourseRanks } from "./course-insights";
import { buildCourseSheet, type CourseSheet } from "./course-sheet";
import type { ProfessorStatsRow, SubjectStatsRow } from "./score";
import { createClient } from "./supabase/server";

const NO_RANKS: CourseRanks = { available: false, score: {}, professor: {}, lighterLoad: null };

export type CourseDetails = {
  id: string;
  code: string;
  name: string;
  programme: string;
  year: number;
  quarters: number[];
};

// Whether a course has this code. For a page that hangs under a course without showing
// its sheet, such as a booklet.
export async function courseExists(code: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").select("code").eq("code", code).maybeSingle();
  if (error) throw new Error(`The course could not be read: ${error.message}`);
  return data !== null;
}

// Null when no course has this code.
export async function getCourseSheet(
  code: string,
): Promise<{ course: CourseDetails; sheet: CourseSheet; ranks: CourseRanks } | null> {
  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, code, name, programme_id, year, quarters")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(`The course could not be read: ${error.message}`);
  if (!course) return null;

  // The access rules already keep hidden professors from students; an admin receives them
  // with hidden set, and buildCourseSheet leaves them out. The ranks among all courses are
  // worked out by the database (course_ranks()), in one call.
  const [links, subject, professors, rankRows] = await Promise.all([
    supabase.from("course_professors").select("professors (id, name, hidden)").eq("course_id", course.id),
    supabase.rpc("course_subject_stats", { p_course_id: course.id }),
    supabase.rpc("course_professor_stats", { p_course_id: course.id }),
    supabase.rpc("course_ranks", { p_course_id: course.id }),
  ]);
  if (links.error) throw new Error(`The professors could not be read: ${links.error.message}`);
  if (subject.error) throw new Error(`The subject averages could not be read: ${subject.error.message}`);
  if (professors.error) throw new Error(`The professor averages could not be read: ${professors.error.message}`);

  // The ranks are extra: when they cannot be read, the card is shown without the rank tiles
  // rather than not at all.
  let ranks: CourseRanks = NO_RANKS;
  if (rankRows.error) console.error("Course ranks left out: they could not be read.", rankRows.error.message);
  else ranks = ranksFromRows(rankRows.data);

  return {
    course: {
      id: course.id,
      code: course.code,
      name: course.name,
      programme: course.programme_id,
      year: course.year,
      quarters: course.quarters,
    },
    sheet: buildCourseSheet(
      links.data.flatMap((link) => (link.professors ? [link.professors] : [])),
      (subject.data[0] as SubjectStatsRow | undefined) ?? null,
      professors.data as ProfessorStatsRow[],
    ),
    ranks,
  };
}

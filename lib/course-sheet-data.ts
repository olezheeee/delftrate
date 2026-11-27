// Reads one course with its professors and averages, as the signed-in user. Uses the
// Supabase server client, so the component that calls it must sit inside <Suspense>.
import { buildCourseSheet, type CourseSheet } from "./course-sheet";
import type { OwnRating } from "./rating";
import type { ProfessorStatsRow, SubjectStatsRow } from "./score";
import { createClient } from "./supabase/server";

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
): Promise<{ course: CourseDetails; sheet: CourseSheet } | null> {
  const supabase = await createClient();
  const { data: course, error } = await supabase
    .from("courses")
    .select("id, code, name, programme_id, year, quarters")
    .eq("code", code)
    .maybeSingle();
  if (error) throw new Error(`The course could not be read: ${error.message}`);
  if (!course) return null;

  // The access rules already keep hidden professors from students; an admin receives them
  // with hidden set, and buildCourseSheet leaves them out.
  const [links, subject, professors] = await Promise.all([
    supabase.from("course_professors").select("professors (id, name, hidden)").eq("course_id", course.id),
    supabase.rpc("course_subject_stats", { p_course_id: course.id }),
    supabase.rpc("course_professor_stats", { p_course_id: course.id }),
  ]);
  if (links.error) throw new Error(`The professors could not be read: ${links.error.message}`);
  if (subject.error) throw new Error(`The subject averages could not be read: ${subject.error.message}`);
  if (professors.error) throw new Error(`The professor averages could not be read: ${professors.error.message}`);

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
  };
}

// The signed-in user's own rating of this course, to start the sliders from.
export async function getOwnRating(courseId: string, userId: string): Promise<OwnRating> {
  const supabase = await createClient();
  // The user_id filter is explicit even though the access rules already return only the
  // user's own rows: an admin must not be different.
  const [subject, professors] = await Promise.all([
    supabase
      .from("subject_ratings")
      .select("difficulty, exam_level, interest")
      .eq("course_id", courseId)
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("professor_ratings")
      .select("professor_id, engagement, understanding, approachability")
      .eq("course_id", courseId)
      .eq("user_id", userId),
  ]);
  if (subject.error) throw new Error(`Your subject rating could not be read: ${subject.error.message}`);
  if (professors.error) throw new Error(`Your professor ratings could not be read: ${professors.error.message}`);

  return {
    subject: subject.data
      ? {
          difficulty: Number(subject.data.difficulty),
          exam_level: Number(subject.data.exam_level),
          interest: Number(subject.data.interest),
        }
      : null,
    professors: Object.fromEntries(
      professors.data.map((row) => [
        row.professor_id,
        {
          engagement: Number(row.engagement),
          understanding: Number(row.understanding),
          approachability: Number(row.approachability),
        },
      ]),
    ),
  };
}

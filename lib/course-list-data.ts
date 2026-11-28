// Reads every course with its professors and averages, as the signed-in user. Uses the
// Supabase server client, so the component that calls it must sit inside <Suspense>. Not
// cached: what comes back depends on the session (an admin also receives hidden professors).
import { buildCourseList, type CourseListEntry } from "./course-list";
import type { ProfessorStatsRow, SubjectStatsRow } from "./score";
import { createClient } from "./supabase/server";

// The API hands out a limited number of rows per request (1000 unless changed). A list that
// was cut off would show courses wrongly, so that is an error instead, as in lib/courses.ts.
// The largest of the four is the professor list, one row per course and professor: the
// bachelor courses of the two launch programmes come to a few hundred at most. Reading in
// pages (.range()) is the fix should the site ever grow past the limit.
function checkComplete(what: string, got: number, count: number | null) {
  if (count !== null && got < count) {
    throw new Error(`Only ${got} of ${count} ${what} were read: the API row limit was reached.`);
  }
}

export async function getCourseList(): Promise<CourseListEntry[]> {
  const supabase = await createClient();
  const [courses, links, subjects, professors] = await Promise.all([
    supabase.from("courses").select("id, code, name, programme_id, year, quarters", { count: "exact" }),
    supabase.from("course_professors").select("course_id, professors (id, name, hidden)", { count: "exact" }),
    supabase.rpc("course_subject_stats", undefined, { count: "exact" }),
    supabase.rpc("course_professor_stats", undefined, { count: "exact" }),
  ]);
  if (courses.error) throw new Error(`The courses could not be read: ${courses.error.message}`);
  if (links.error) throw new Error(`The professors could not be read: ${links.error.message}`);
  if (subjects.error) throw new Error(`The subject averages could not be read: ${subjects.error.message}`);
  if (professors.error) throw new Error(`The professor averages could not be read: ${professors.error.message}`);
  checkComplete("courses", courses.data.length, courses.count);
  checkComplete("professor links", links.data.length, links.count);
  checkComplete("subject averages", subjects.data.length, subjects.count);
  checkComplete("professor averages", professors.data.length, professors.count);

  return buildCourseList(
    courses.data.map((course) => ({
      id: course.id,
      code: course.code,
      name: course.name,
      programme_id: course.programme_id,
      year: course.year,
      quarters: course.quarters,
    })),
    links.data,
    subjects.data as SubjectStatsRow[],
    professors.data as ProfessorStatsRow[],
  );
}

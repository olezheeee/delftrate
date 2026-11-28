import { cacheLife, cacheTag } from "next/cache";
import type { CalendarCourse } from "./calendar";
import { createPublicClient } from "./supabase/public";

// Whatever changes courses (the import, the admin panel) calls revalidateTag with this, so
// the calendar shows the change at once instead of when the cache runs out.
export const COURSES_TAG = "courses";

// Every course with its quarters, for the calendar on the home page. The list is public
// and the same for everyone, so it is cached and shared between visitors.
export async function getCalendarCourses(): Promise<CalendarCourse[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(COURSES_TAG);

  const { data, error, count } = await createPublicClient()
    .from("courses")
    .select("code, name, programme_id, year, quarters", { count: "exact" })
    .order("code");
  if (error) throw new Error(`The courses could not be read: ${error.message}`);
  // The API hands out a limited number of rows per request (1000 unless changed). A list
  // that was cut off would quietly miss courses, so that is an error instead.
  if (count !== null && data.length < count) {
    throw new Error(`Only ${data.length} of ${count} courses were read: the API row limit was reached.`);
  }
  return data.map((row) => ({
    code: row.code,
    name: row.name,
    programme: row.programme_id,
    year: row.year,
    quarters: row.quarters,
  }));
}

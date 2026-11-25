import { cacheLife, cacheTag } from "next/cache";
import type { CalendarCourse } from "./calendar";
import { createPublicClient } from "./supabase/public";

export type Programme = { id: string; name: string };

// Cache tags. Whatever changes courses or programmes (the admin panel, Pack 6) calls
// revalidateTag with these so the home page shows the change at once instead of after
// the cache lifetime.
export const COURSES_TAG = "courses";
export const PROGRAMMES_TAG = "programmes";

export async function getCalendarCourses(): Promise<CalendarCourse[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(COURSES_TAG);

  const { data, error, count } = await createPublicClient()
    .from("courses")
    .select("code, name, programme_id, year, quarters", { count: "exact" })
    .order("code");
  if (error) throw new Error(`Could not load courses: ${error.message}`);
  // The API returns at most a fixed number of rows per request (1000 by default). A cut-off
  // list would quietly leave courses out of the calendar, so fail loudly instead; page the
  // query if the course list ever grows that large.
  if (count !== null && data.length < count) {
    throw new Error(`Loaded only ${data.length} of ${count} courses: the API row limit was reached`);
  }
  return data.map((r) => ({
    code: r.code,
    name: r.name,
    programme: r.programme_id,
    year: r.year,
    quarters: r.quarters,
  }));
}

export async function getProgrammes(): Promise<Programme[]> {
  "use cache";
  cacheLife("hours");
  cacheTag(PROGRAMMES_TAG);

  const { data, error } = await createPublicClient()
    .from("programmes")
    .select("id, name")
    .order("name");
  if (error) throw new Error(`Could not load programmes: ${error.message}`);
  return data;
}

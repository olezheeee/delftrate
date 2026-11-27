import { cacheLife, cacheTag } from "next/cache";
import type { CourseNumbers } from "./calendar";
import { createPublicClient } from "./supabase/public";

// Whatever changes a rating (a posted rating, manual votes in the admin panel) calls
// revalidateTag with this, so the calendar shows the change at once. Without it the
// numbers are at most five minutes old.
export const SCORES_TAG = "scores";

// How long the home page waits for the ratings before it shows the calendar without them.
// Reading them takes a fraction of a second; this is for a database that is slow or does
// not answer, which must not keep the course list from the visitor.
export const RATINGS_WAIT_MS = 2000;

/** The result of `work`, or an error when it takes longer than `ms` milliseconds. */
export function within<T>(work: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`No answer within ${ms} ms.`)), ms);
  });
  return Promise.race([work, late]).finally(() => clearTimeout(timer));
}

/** By course code. A course without any number yet is left out. */
export type CalendarScores = Record<string, CourseNumbers>;

// The three numbers the calendar shows next to each course. They are public and the same
// for everyone (the database function calendar_scores() decides what is handed out), so
// they are cached and shared between visitors, like the course list.
export async function getCalendarScores(): Promise<CalendarScores> {
  "use cache";
  // Read again in the background once a minute old, and never shown older than five.
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });
  cacheTag(SCORES_TAG);

  const { data, error, count } = await createPublicClient().rpc("calendar_scores", undefined, { count: "exact" });
  if (error) throw new Error(`The ratings could not be read: ${error.message}`);
  // The API hands out a limited number of rows per request (1000 unless changed). A list
  // that was cut off would quietly show courses as not rated, so that is an error instead.
  if (count !== null && data.length < count) {
    throw new Error(`Only ${data.length} of ${count} rated courses were read: the API row limit was reached.`);
  }
  return Object.fromEntries(
    data.map((row) => [row.code, { score: row.score, load: row.load, teach: row.teach }]),
  );
}

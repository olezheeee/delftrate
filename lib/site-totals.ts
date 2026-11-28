import { cacheLife, cacheTag } from "next/cache";
import { createPublicClient } from "./supabase/public";

// Whatever wants the bar to show a change at once (a posted rating, say) calls
// revalidateTag with this. Without it the numbers are at most five minutes old.
export const TOTALS_TAG = "totals";

export type SiteTotals = { votes: number; students: number; courses: number };

// The three numbers in the bar at the top of the home page. They are public and the same
// for everyone, so they are cached and shared between visitors.
export async function getSiteTotals(): Promise<SiteTotals> {
  "use cache";
  // Read again in the background once a minute old, and never shown older than five.
  cacheLife({ stale: 300, revalidate: 60, expire: 300 });
  cacheTag(TOTALS_TAG);

  const { data, error } = await createPublicClient().rpc("site_totals").single();
  if (error) throw new Error(`The site totals could not be read: ${error.message}`);
  return { votes: data.votes, students: data.students, courses: data.courses };
}

const NUMBER = new Intl.NumberFormat("en-GB");

// The totals as the bar shows them: "1,240" with "votes", "1" with "vote".
export function totalsText(totals: SiteTotals): { key: keyof SiteTotals; count: string; label: string }[] {
  const item = (key: keyof SiteTotals, one: string, many: string) => ({
    key,
    count: NUMBER.format(totals[key]),
    label: totals[key] === 1 ? one : many,
  });
  return [item("votes", "vote", "votes"), item("students", "student", "students"), item("courses", "course", "courses")];
}

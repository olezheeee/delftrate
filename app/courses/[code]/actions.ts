"use server";

import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { parseRating, ratingErrorMessage } from "@/lib/rating";
import { createClient } from "@/lib/supabase/server";

export type RatingState = { error?: string; saved?: boolean };

// Anyone can post to a Server Action, so the input is checked again here. The user comes
// from the session; the database decides the programme and whether the professor teaches
// the course.
export async function submitRating(_previous: RatingState, input: unknown): Promise<RatingState> {
  const user = await getCurrentUser();
  if (!user) return { error: "Sign in to rate a course." };

  const parsed = parseRating(input);
  if (!parsed.ok) return { error: parsed.error };
  const { courseId, professorId, values } = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_rating", {
    p_course_id: courseId,
    p_professor_id: professorId,
    p_difficulty: values.difficulty,
    p_exam_level: values.exam_level,
    p_interest: values.interest,
    p_engagement: values.engagement,
    p_understanding: values.understanding,
    p_approachability: values.approachability,
  });
  if (error) {
    // The professor is gone or the course is not the user's: the open page is out of date,
    // so render it again and let it show the new state. Not for "sign in" (also 42501): the
    // page would send the user to the login page and lose the sliders.
    const outOfDate = error.code === "23503" || (error.code === "42501" && /own programme/i.test(error.message));
    if (outOfDate) refresh();
    return { error: ratingErrorMessage(error) };
  }

  // The page is rendered per request, so a refresh shows the new vote counts in this round trip.
  refresh();
  return { saved: true };
}

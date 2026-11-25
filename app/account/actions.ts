"use server";

import { redirect } from "next/navigation";
import type { FormState } from "@/app/ui/form";
import { requireUser } from "@/lib/auth/session";
import { validateProfile } from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

// For an account that has no profile yet (see getProfile). The database lets a user create
// only their own profile, only once, and never as an admin.
export async function completeProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const input = { programme: formData.get("programme"), year: formData.get("year") };
  const values = {
    programme: typeof input.programme === "string" ? input.programme : "",
    year: typeof input.year === "string" ? input.year : "",
  };
  const result = validateProfile(input);
  if (!result.ok) return { fieldErrors: result.errors, values };

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .insert({ id: user.id, programme_id: result.data.programme, year: result.data.year });
  // 23505: the profile already exists (saved from another tab). Nothing left to do.
  if (error && error.code !== "23505") {
    return { error: "Your profile could not be saved. Please try again in a moment.", values };
  }
  redirect("/account");
}

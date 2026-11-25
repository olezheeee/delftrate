// Who is signed in. Use these in Server Components, Server Actions and Route Handlers;
// they read cookies, so a component that calls them must sit inside <Suspense>.
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type CurrentUser = { id: string; email: string };
export type Profile = Pick<Tables<"profiles">, "programme_id" | "year" | "is_admin">;

// The signed-in user, or null. The token is verified, not just read from the cookie.
// Cached for the length of one request, so several components can ask without extra work.
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  return { id: claims.sub, email: typeof claims.email === "string" ? claims.email : "" };
});

// For pages and actions that need an account: signed-out visitors go to the login page.
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

// The profile is saved at the end of registering, and a registration that cannot save it
// is undone. It is missing only when that undoing failed too, or for an account made
// outside the site (for example from the Supabase dashboard); the account page asks for
// the programme and year then.
export const getProfile = cache(async (): Promise<Profile | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("programme_id, year, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  if (error) throw new Error(`The profile could not be read: ${error.message}`);
  return data;
});

// For pages that need to know the user's programme (courses, rating): a user without a
// profile is sent to the account page to finish it.
export async function requireProfile(): Promise<{ user: CurrentUser; profile: Profile }> {
  const user = await requireUser();
  const profile = await getProfile();
  if (!profile) redirect("/account");
  return { user, profile };
}

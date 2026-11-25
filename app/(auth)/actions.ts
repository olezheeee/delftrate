"use server";

// The actions behind the account forms. Each one checks its input again on the server,
// talks to Supabase Auth with the server client (which stores the session in cookies) and
// either redirects or hands a message back to the form.
import { redirect } from "next/navigation";
import type { FormState } from "@/app/ui/form";
import { authErrorMessage } from "@/lib/auth/errors";
import { safeNextPath, SIGNED_IN_HOME } from "@/lib/auth/routes";
import {
  normalizeEmail,
  validateEmailOnly,
  validateLogin,
  validatePasswordReset,
  validateRegistration,
} from "@/lib/auth/validation";
import { createClient } from "@/lib/supabase/server";

function field(formData: FormData, name: string): string {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function withEmail(path: string, email: string): string {
  return `${path}?email=${encodeURIComponent(email)}`;
}

// Step 1 of registering: only the email address. The account that Supabase makes here is
// an empty shell with a password nobody knows. Everything that matters (the real password,
// the programme and the year) is set in step 2 by whoever holds the emailed code, so
// someone who starts a registration with another person's address gains nothing from it.
export async function register(_previous: FormState, formData: FormData): Promise<FormState> {
  const input = { email: field(formData, "email") };
  const result = validateEmailOnly(input);
  if (!result.ok) return { fieldErrors: result.errors, values: input };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: result.data.email,
    password: crypto.randomUUID() + crypto.randomUUID(),
  });
  if (error) return { error: authErrorMessage(error, "register"), values: input };
  // The same answer for an address that already has an account: Supabase sends nothing
  // then, and the next page says so.
  redirect(withEmail("/verify", result.data.email));
}

// Step 2: the code, the password, the programme and the year.
export async function completeRegistration(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = {
    email: field(formData, "email"),
    code: field(formData, "code"),
    password: field(formData, "password"),
    programme: field(formData, "programme"),
    year: field(formData, "year"),
  };
  // Everything except the password goes back into the form after a failed attempt.
  const values = {
    email: input.email,
    code: input.code,
    programme: input.programme,
    year: input.year,
  };
  const supabase = await createClient();

  if (field(formData, "intent") === "resend") {
    const result = validateEmailOnly(input);
    if (!result.ok) return { fieldErrors: result.errors, values };
    const { error } = await supabase.auth.resend({ type: "signup", email: result.data.email });
    if (error) return { error: authErrorMessage(error, "resend"), values };
    return {
      notice:
        "If this address is waiting to be confirmed, we sent it a new code and the earlier one no longer works.",
      values: { ...values, code: "" },
    };
  }

  const result = validateRegistration(input);
  if (!result.ok) return { fieldErrors: result.errors, values };
  const { email, code, password, programme, year } = result.data;

  const verified = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (verified.error) return { error: authErrorMessage(verified.error, "verify"), values };
  const userId = verified.data.user?.id;

  // The address is confirmed and the user is signed in. Now make the account theirs.
  const updated = await supabase.auth.updateUser({ password });
  if (updated.error || !userId) {
    // Without a password they could never log in again, so do not pretend it worked.
    await supabase.auth.signOut({ scope: "local" });
    return {
      error:
        "Your email address is confirmed, but your password could not be saved. Use \"Forgot your password?\" on the login page to set it.",
      values: { email: input.email },
    };
  }

  // The database lets a user create only their own profile. If this fails, the account
  // page asks for the programme and year again.
  await supabase.from("profiles").insert({ id: userId, programme_id: programme, year });
  redirect(SIGNED_IN_HOME);
}

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const input = { email: field(formData, "email"), password: field(formData, "password") };
  const values = { email: input.email };
  const result = validateLogin(input);
  if (!result.ok) return { fieldErrors: result.errors, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) {
    // The registration was started but never finished: continue where they stopped.
    if (error.code === "email_not_confirmed") redirect(withEmail("/verify", result.data.email));
    return { error: authErrorMessage(error, "login"), values };
  }
  redirect(safeNextPath(field(formData, "next")));
}

export async function logout(): Promise<void> {
  const supabase = await createClient();
  // "local" ends this browser's session only; the user stays signed in on other devices.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}

export async function requestPasswordReset(
  _previous: FormState,
  formData: FormData,
): Promise<FormState> {
  const input = { email: field(formData, "email") };
  const result = validateEmailOnly(input);
  if (!result.ok) return { fieldErrors: result.errors, values: input };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(result.data.email);
  if (error) return { error: authErrorMessage(error, "forgot"), values: input };
  // The same answer whether or not the address has an account, so this form cannot be
  // used to find out who is registered.
  redirect(withEmail("/reset-password", result.data.email));
}

export async function resetPassword(_previous: FormState, formData: FormData): Promise<FormState> {
  const input = {
    email: field(formData, "email"),
    code: field(formData, "code"),
    password: field(formData, "password"),
  };
  const values = { email: input.email, code: input.code };
  const supabase = await createClient();

  if (field(formData, "intent") === "resend") {
    const result = validateEmailOnly(input);
    if (!result.ok) return { fieldErrors: result.errors, values };
    const { error } = await supabase.auth.resetPasswordForEmail(result.data.email);
    if (error) return { error: authErrorMessage(error, "forgot"), values };
    return {
      notice: "We sent a new code. The earlier one no longer works.",
      values: { email: input.email },
    };
  }

  // The new password is checked before the code is used: a code works once.
  const result = validatePasswordReset(input);
  if (!result.ok) return { fieldErrors: result.errors, values };
  const { email, code, password } = result.data;

  const verified = await supabase.auth.verifyOtp({ email, token: code, type: "recovery" });
  if (verified.error) return { error: authErrorMessage(verified.error, "reset"), values };

  // The code is used up and the user is signed in. Now store the new password.
  const updated = await supabase.auth.updateUser({ password });
  if (updated.error && updated.error.code !== "same_password") {
    // Do not leave someone signed in on the strength of the emailed code alone.
    await supabase.auth.signOut({ scope: "local" });
    return {
      error: `${authErrorMessage(updated.error, "reset")} Your password was not changed. Send a new code to try again.`,
      values: { email: normalizeEmail(input.email) },
    };
  }
  redirect(SIGNED_IN_HOME);
}

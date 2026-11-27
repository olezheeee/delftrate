"use server";

// The actions behind the account forms. Each one checks its input again on the server,
// talks to Supabase Auth with the server client (which stores the session in cookies) and
// either redirects or hands a message back to the form.
import { redirect } from "next/navigation";
import type { FormState } from "@/app/ui/form";
import { authErrorMessage, emailSentMomentAgo } from "@/lib/auth/errors";
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

const GENERIC_PROBLEM = "Something went wrong on our side.";

function withEmail(path: string, email: string): string {
  return `${path}?email=${encodeURIComponent(email)}`;
}

// The password of the empty shell that step 1 makes (see register): random, and never
// shown or stored anywhere. It is 72 characters, the most Supabase accepts, and ends in a
// lowercase letter, an uppercase letter, a digit and a symbol, so it also passes any
// password requirements switched on in the dashboard.
function shellPassword(): string {
  return crypto.randomUUID() + crypto.randomUUID().slice(0, 32) + "aA1!";
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
    password: shellPassword(),
  });
  // Asking again within a minute is not a failure: the code sent a moment ago still works.
  if (error && !emailSentMomentAgo(error)) {
    return { error: authErrorMessage(error, "register"), values: input };
  }
  // The same answer for an address that already has an account: Supabase sends nothing
  // then, and the next page says so. That is also why "asked again within a minute" is not
  // shown above: Supabase says it only for an address without an account.
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
    if (error && !emailSentMomentAgo(error)) {
      return { error: authErrorMessage(error, "resend"), values };
    }
    // One answer for every address, so it has to be true for all of them: a new code was
    // sent, or one was sent less than a minute ago, or the address is not waiting at all.
    return {
      notice:
        "If this address is waiting to be confirmed, we send it a new code, at most once a minute. When the new code arrives, the earlier one no longer works.",
      values: { ...values, code: "" },
    };
  }

  const result = validateRegistration(input);
  if (!result.ok) return { fieldErrors: result.errors, values };
  const { email, code, password, programme, year } = result.data;

  const verified = await supabase.auth.verifyOtp({ email, token: code, type: "signup" });
  if (verified.error) return { error: authErrorMessage(verified.error, "verify"), values };
  const userId = verified.data.user?.id;

  // The address is confirmed and the user is signed in. The database forgot whatever
  // password the shell had in that same moment (see the migration that adds
  // forget_password_on_confirmation), so if this request stops here, nobody can log in with
  // a password that was set before the code was entered.
  //
  // An account exists only with a password and a profile as well, so when either cannot be
  // saved the whole account is removed again (see the migration that adds
  // cancel_unfinished_registration).
  let problem: string | null = null;
  if (!userId) {
    problem = GENERIC_PROBLEM;
  } else {
    const updated = await supabase.auth.updateUser({ password });
    if (updated.error) {
      problem = authErrorMessage(updated.error, "verify");
    } else {
      const saved = await supabase
        .from("profiles")
        .insert({ id: userId, programme_id: programme, year });
      // 23505: the profile is already there (the form was sent twice). Nothing left to do.
      if (saved.error && saved.error.code !== "23505") {
        problem = "Your programme and year could not be saved.";
      }
    }
  }
  if (!problem) redirect(SIGNED_IN_HOME);

  const cancelled = await supabase.rpc("cancel_unfinished_registration");
  await supabase.auth.signOut({ scope: "local" });
  if (cancelled.error || !cancelled.data) {
    // The account could not be removed either. Say what is true and how to get in.
    return {
      error: `${problem} Your email address is confirmed, but your account is not finished. Use "Forgot your password?" on the login page to get in and finish it.`,
      values: { email },
    };
  }

  // Nothing is left of the account, and the code is used up. Start the registration again
  // so the student only has to type the new code.
  const restarted = await supabase.auth.signUp({ email, password: shellPassword() });
  return {
    error: restarted.error
      ? `${problem} No account was created. Register again to get a new code.`
      : `${problem} No account was created. We sent you a new code: enter it and try again.`,
    values: { ...values, email, code: "" },
  };
}

export async function login(_previous: FormState, formData: FormData): Promise<FormState> {
  const input = { email: field(formData, "email"), password: field(formData, "password") };
  const values = { email: input.email };
  const result = validateLogin(input);
  if (!result.ok) return { fieldErrors: result.errors, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(result.data);
  if (error) {
    // The password was right but the address is not confirmed: continue with the code.
    // Supabase checks the password first, and a registration started on the site has a
    // password nobody knows until it is finished, so this is reached only for an account
    // made outside the site. Everyone else gets the same "not correct" as for a wrong password.
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
  // Asking again within a minute is not a failure: the code sent a moment ago still works.
  if (error && !emailSentMomentAgo(error)) {
    return { error: authErrorMessage(error, "forgot"), values: input };
  }
  // The same answer whether or not the address has an account, so this form cannot be
  // used to find out who is registered. That is also why "asked again within a minute" is
  // not shown above: Supabase says it only for an address that has an account.
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
    if (error && !emailSentMomentAgo(error)) {
      return { error: authErrorMessage(error, "forgot"), values };
    }
    // One answer whether or not the address has an account, true in every case: a new code
    // was sent, or one was sent less than a minute ago, or there is no account.
    return {
      notice:
        "We send a new code at most once a minute. When the new code arrives, the earlier one no longer works.",
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

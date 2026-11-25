// Turns an error from Supabase Auth into a sentence for the user. Supabase's own messages
// are written for developers and change between versions; its error codes do not.

type AuthFailure = { code?: string; status?: number; message?: string };

export type AuthFlow = "register" | "verify" | "resend" | "login" | "forgot" | "reset";

const GENERIC = "Something went wrong on our side. Please try again in a moment.";

export function authErrorMessage(error: AuthFailure, flow: AuthFlow): string {
  switch (error.code) {
    case "invalid_credentials":
      return "The email address or the password is not correct.";
    case "email_not_confirmed":
      return "This email address is not confirmed yet. Enter the code we sent you.";
    case "otp_expired":
      // Supabase answers the same for a wrong code and for an expired one.
      return "This code is not correct or has expired. Check it, or send a new one.";
    case "user_already_exists":
    case "email_exists":
      return "There is already an account with this email address. Log in instead.";
    case "weak_password":
      return "This password is too easy to guess. Choose a longer one.";
    case "same_password":
      return "This is already your password.";
    case "email_address_invalid":
      return "This email address cannot receive our emails. Check it for typing mistakes.";
    case "email_address_not_authorized":
      return "We cannot send email to this address yet.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Registration is closed at the moment.";
    case "user_banned":
      return "This account is blocked.";
    case "over_email_send_rate_limit":
      // One code covers two limits: asking again within a minute ("... after 42 seconds")
      // and the hourly limit of the whole site. Only the message tells them apart.
      return /after \d+ seconds/.test(error.message ?? "")
        ? "You asked for an email a moment ago. Wait a minute before asking again."
        : "We sent too many emails in a short time. Wait a few minutes and try again.";
    case "over_request_rate_limit":
      return "Too many attempts. Wait a few minutes and try again.";
    case "validation_failed":
      return flow === "verify" || flow === "reset"
        ? "This code is not correct or has expired. Check it, or send a new one."
        : "Check what you filled in and try again.";
  }
  // Asking again too soon comes back as a plain 429 with the waiting time in the message.
  if (error.status === 429) {
    return flow === "login"
      ? "Too many attempts. Wait a few minutes and try again."
      : "You asked for an email a moment ago. Wait a minute before asking again.";
  }
  return GENERIC;
}

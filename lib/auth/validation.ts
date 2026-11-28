// Checks of what a user types into the account forms. They run on the server in every
// action; the forms repeat the simple ones as HTML attributes for quicker feedback.
import { PROGRAMMES, YEARS, type ProgrammeId } from "./programmes";

// Must match auth.minimum_password_length and auth.email.otp_length in supabase/config.jsonc.
export const MIN_PASSWORD_LENGTH = 8;
export const CODE_LENGTH = 6;
// bcrypt, which stores the password, ignores everything after 72 bytes.
const MAX_PASSWORD_BYTES = 72;

export type FieldErrors = Partial<
  Record<"email" | "password" | "programme" | "year" | "code", string>
>;

export type Result<T> = { ok: true; data: T } | { ok: false; errors: FieldErrors };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeEmail(value: unknown): string {
  return text(value).trim().toLowerCase();
}

// Registration is open to any address for now. The restriction to TU Delft student
// addresses belongs here and in the database, and is added before launch.
export function emailError(email: string): string | undefined {
  if (!email) return "Enter your email address.";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "This does not look like an email address.";
  }
}

export function passwordError(password: string): string | undefined {
  if (!password) return "Enter a password.";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (new TextEncoder().encode(password).length > MAX_PASSWORD_BYTES) {
    return "This password is too long.";
  }
}

// People paste codes with spaces around or inside them ("123 456").
export function normalizeCode(value: unknown): string {
  return text(value).replace(/\s+/g, "");
}

export function codeError(code: string): string | undefined {
  if (!code) return "Enter the code from the email.";
  if (!new RegExp(`^\\d{${CODE_LENGTH}}$`).test(code)) {
    return `The code is ${CODE_LENGTH} digits.`;
  }
}

export function validateProfile(input: {
  programme: unknown;
  year: unknown;
}): Result<{ programme: ProgrammeId; year: number }> {
  const errors: FieldErrors = {};
  const programme = PROGRAMMES.find((p) => p.id === text(input.programme))?.id;
  const year = YEARS.find((y) => String(y) === text(input.year));
  if (!programme) errors.programme = "Choose your programme.";
  if (!year) errors.year = "Choose your year.";
  if (!programme || !year) return { ok: false, errors };
  return { ok: true, data: { programme, year } };
}

// The second step of registering: the emailed code together with everything the account
// needs. All of it is checked before the code is used, because a code works once.
export function validateRegistration(input: {
  email: unknown;
  code: unknown;
  password: unknown;
  programme: unknown;
  year: unknown;
}): Result<{ email: string; code: string; password: string; programme: ProgrammeId; year: number }> {
  const password = text(input.password);
  const base = validateCode(input);
  const profile = validateProfile(input);
  const passwordProblem = passwordError(password);
  const errors: FieldErrors = {
    ...(base.ok ? {} : base.errors),
    ...(profile.ok ? {} : profile.errors),
    ...(passwordProblem ? { password: passwordProblem } : {}),
  };
  if (!base.ok || !profile.ok || passwordProblem) return { ok: false, errors };
  return { ok: true, data: { ...base.data, password, ...profile.data } };
}

// Logging in only checks that both fields are filled: an account made under older
// password rules must still be able to get in.
export function validateLogin(input: {
  email: unknown;
  password: unknown;
}): Result<{ email: string; password: string }> {
  const email = normalizeEmail(input.email);
  const password = text(input.password);
  const errors: FieldErrors = {};
  const emailProblem = emailError(email);
  if (emailProblem) errors.email = emailProblem;
  if (!password) errors.password = "Enter your password.";
  if (emailProblem || !password) return { ok: false, errors };
  return { ok: true, data: { email, password } };
}

export function validateEmailOnly(input: { email: unknown }): Result<{ email: string }> {
  const email = normalizeEmail(input.email);
  const problem = emailError(email);
  return problem ? { ok: false, errors: { email: problem } } : { ok: true, data: { email } };
}

export function validateCode(input: {
  email: unknown;
  code: unknown;
}): Result<{ email: string; code: string }> {
  const email = normalizeEmail(input.email);
  const code = normalizeCode(input.code);
  const errors: FieldErrors = {};
  const emailProblem = emailError(email);
  const codeProblem = codeError(code);
  if (emailProblem) errors.email = emailProblem;
  if (codeProblem) errors.code = codeProblem;
  if (emailProblem || codeProblem) return { ok: false, errors };
  return { ok: true, data: { email, code } };
}

export function validatePasswordReset(input: {
  email: unknown;
  code: unknown;
  password: unknown;
}): Result<{ email: string; code: string; password: string }> {
  const password = text(input.password);
  const base = validateCode(input);
  const errors: FieldErrors = base.ok ? {} : { ...base.errors };
  const passwordProblem = passwordError(password);
  if (passwordProblem) errors.password = passwordProblem;
  if (!base.ok || passwordProblem) return { ok: false, errors };
  return { ok: true, data: { ...base.data, password } };
}

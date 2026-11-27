"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import {
  Field,
  Messages,
  ProfileFields,
  ResendButton,
  SubmitButton,
  type FormState,
} from "@/app/ui/form";
import styles from "@/app/ui/form.module.css";
import { CODE_LENGTH, MIN_PASSWORD_LENGTH } from "@/lib/auth/validation";
import {
  completeRegistration,
  login,
  register,
  requestPasswordReset,
  resetPassword,
} from "./actions";

const EMPTY: FormState = {};

export function RegisterForm() {
  const [state, action] = useActionState(register, EMPTY);
  return (
    <form action={action} className={styles.form}>
      <Messages state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending the code…">Send me a code</SubmitButton>
    </form>
  );
}

function CodeField({ value, error }: { value?: string; error?: string }) {
  return (
    <Field
      label={`${CODE_LENGTH}-digit code`}
      name="code"
      className={styles.code}
      inputMode="numeric"
      autoComplete="one-time-code"
      pattern="[0-9 ]*"
      maxLength={CODE_LENGTH + 4}
      required
      autoFocus
      defaultValue={value}
      error={error}
    />
  );
}

function ResendHint() {
  return (
    <p className={styles.hint}>
      No email after a minute? Look in your spam folder, or{" "}
      <ResendButton>send a new code</ResendButton>.
    </p>
  );
}

export function CompleteRegistrationForm() {
  const [state, action] = useActionState(completeRegistration, EMPTY);
  const fromAddress = useSearchParams().get("email");
  const email = state.values?.email ?? fromAddress ?? "";
  return (
    <form action={action} className={styles.form}>
      <Messages state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={email}
        error={state.fieldErrors?.email}
      />
      <CodeField value={state.values?.code} error={state.fieldErrors?.code} />
      <Field
        label="Choose a password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={state.fieldErrors?.password}
      />
      <ProfileFields state={state} />
      <SubmitButton pendingLabel="Creating your account…">Create account</SubmitButton>
      <ResendHint />
    </form>
  );
}

export function LoginForm() {
  const [state, action] = useActionState(login, EMPTY);
  const next = useSearchParams().get("next") ?? "";
  return (
    <form action={action} className={styles.form}>
      <Messages state={state} />
      <input type="hidden" name="next" value={next} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Logging in…">Log in</SubmitButton>
      <p className={styles.hint}>
        <Link className={styles.link} href="/forgot-password">
          Forgot your password?
        </Link>
      </p>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState(requestPasswordReset, EMPTY);
  return (
    <form action={action} className={styles.form}>
      <Messages state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        error={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Sending…">Send a reset code</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm() {
  const [state, action] = useActionState(resetPassword, EMPTY);
  const fromAddress = useSearchParams().get("email");
  const email = state.values?.email ?? fromAddress ?? "";
  return (
    <form action={action} className={styles.form}>
      <Messages state={state} />
      <Field
        label="Email address"
        name="email"
        type="email"
        autoComplete="email"
        required
        defaultValue={email}
        error={state.fieldErrors?.email}
      />
      <CodeField value={state.values?.code} error={state.fieldErrors?.code} />
      <Field
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={state.fieldErrors?.password}
      />
      <SubmitButton pendingLabel="Saving…">Set new password</SubmitButton>
      <ResendHint />
    </form>
  );
}

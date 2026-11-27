"use client";

// Building blocks shared by the account forms.
import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { PROGRAMMES, YEARS } from "@/lib/auth/programmes";
import styles from "./form.module.css";

// What a form action hands back to its form. `values` refills the fields after a failed
// attempt, because the browser form is reset when an action finishes. Passwords are never
// sent back.
export type FormState = {
  error?: string;
  notice?: string;
  fieldErrors?: Partial<Record<string, string>>;
  values?: Partial<Record<string, string>>;
};

export function Field({
  label,
  error,
  hint,
  className,
  ...input
}: {
  label: string;
  error?: string;
  hint?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && !error && `${id}-hint`].filter(Boolean).join(" ");
  return (
    <div className={styles.field}>
      <label className={styles.label} htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={[styles.input, className].filter(Boolean).join(" ")}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        {...input}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className={styles.hint}>
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

function Choices({
  legend,
  name,
  options,
  selected,
  error,
}: {
  legend: string;
  name: string;
  options: readonly { value: string; label: string }[];
  selected?: string;
  error?: string;
}) {
  const id = useId();
  return (
    <fieldset className={styles.field} aria-describedby={error ? `${id}-error` : undefined}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.choices}>
        {options.map((option) => (
          <label key={option.value} className={styles.choice}>
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={selected === option.value}
              required
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
      {error && (
        <p id={`${id}-error`} className={styles.fieldError}>
          {error}
        </p>
      )}
    </fieldset>
  );
}

// The programme and year questions, used when registering and when finishing a profile.
export function ProfileFields({ state }: { state: FormState }) {
  return (
    <>
      <Choices
        legend="Programme"
        name="programme"
        options={PROGRAMMES.map((programme) => ({ value: programme.id, label: programme.name }))}
        selected={state.values?.programme}
        error={state.fieldErrors?.programme}
      />
      <Choices
        legend="Year"
        name="year"
        options={YEARS.map((year) => ({ value: String(year), label: `Year ${year}` }))}
        selected={state.values?.year}
        error={state.fieldErrors?.year}
      />
    </>
  );
}

export function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && (
        <p role="alert" className={styles.alert}>
          {state.error}
        </p>
      )}
      {state.notice && (
        <p role="status" className={styles.notice}>
          {state.notice}
        </p>
      )}
    </>
  );
}

export function SubmitButton({ children, pendingLabel }: { children: ReactNode; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={styles.button} disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

// A second button inside a form: sends the same fields with intent=resend and skips the
// browser's "required" checks, so a new code can be asked for with the code field empty.
export function ResendButton({ children }: { children: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="intent"
      value="resend"
      formNoValidate
      className={styles.textButton}
      disabled={pending}
    >
      {children}
    </button>
  );
}

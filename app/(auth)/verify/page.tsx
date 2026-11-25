import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/app/ui/form.module.css";
import { CompleteRegistrationForm } from "../forms";

export const metadata: Metadata = { title: "Finish your account — DelftRate" };

export default function VerifyPage() {
  return (
    <>
      <span className="mono">Step 2 of 2</span>
      <h1 className={styles.title}>
        Check your <em>email.</em>
      </h1>
      <p className={styles.lead}>
        If this address has no account yet, we sent it a code that works for one hour. Enter
        it here and finish your account. The programme decides which courses you can rate and
        cannot be changed later.
      </p>
      {/* The form reads the email address from the page address, which is only known per request. */}
      <Suspense fallback={<div className={styles.skeleton} />}>
        <CompleteRegistrationForm />
      </Suspense>
      <p className={styles.footer}>
        Already have an account? <Link href="/login">Log in</Link> or{" "}
        <Link href="/forgot-password">reset your password</Link>.
      </p>
    </>
  );
}

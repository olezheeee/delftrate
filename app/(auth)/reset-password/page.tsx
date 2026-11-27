import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/app/ui/form.module.css";
import { ResetPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Choose a new password — DelftRate" };

export default function ResetPasswordPage() {
  return (
    <>
      <span className="mono">Password</span>
      <h1 className={styles.title}>
        Choose a new <em>password.</em>
      </h1>
      <p className={styles.lead}>
        If there is an account with that email address, we sent it a code. Enter the code and
        your new password. The code works for one hour.
      </p>
      {/* The form reads the email address from the page address, which is only known per request. */}
      <Suspense fallback={<div className={styles.skeleton} />}>
        <ResetPasswordForm />
      </Suspense>
      <p className={styles.footer}>
        <Link href="/login">Back to log in</Link>
      </p>
    </>
  );
}

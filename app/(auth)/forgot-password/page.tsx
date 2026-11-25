import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/ui/form.module.css";
import { ForgotPasswordForm } from "../forms";

export const metadata: Metadata = { title: "Reset your password — DelftRate" };

export default function ForgotPasswordPage() {
  return (
    <>
      <span className="mono">Password</span>
      <h1 className={styles.title}>
        Forgot your <em>password?</em>
      </h1>
      <p className={styles.lead}>
        Enter the email address of your account. We send you a code to choose a new password.
      </p>
      <ForgotPasswordForm />
      <p className={styles.footer}>
        Remembered it? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}

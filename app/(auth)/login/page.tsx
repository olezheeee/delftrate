import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import styles from "@/app/ui/form.module.css";
import { LoginForm } from "../forms";

export const metadata: Metadata = { title: "Log in — DelftRate" };

export default function LoginPage() {
  return (
    <>
      <span className="mono">Welcome back</span>
      <h1 className={styles.title}>
        Log <em>in.</em>
      </h1>
      <p className={styles.lead}>Ratings are for registered students only.</p>
      {/* The form reads the page to return to from the page address, which is only known per request. */}
      <Suspense fallback={<div className={styles.skeleton} />}>
        <LoginForm />
      </Suspense>
      <p className={styles.footer}>
        No account yet? <Link href="/register">Create one</Link>
      </p>
    </>
  );
}

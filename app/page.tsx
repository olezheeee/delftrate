import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <span className="mono">DelftRate · in development</span>
      <h1 className={styles.title}>
        Know your course before the <em>first lecture.</em>
      </h1>
      <p className={styles.lead}>
        The real application is being built here. The approved demonstration is
        index.html at the root of the repository.
      </p>
      {/* Reads the session, so it is rendered per request behind this boundary. */}
      <Suspense fallback={<nav className={styles.nav} aria-hidden="true" />}>
        <AccountLinks />
      </Suspense>
    </main>
  );
}

async function AccountLinks() {
  const user = await getCurrentUser();
  return (
    <nav className={styles.nav} aria-label="Account">
      {user ? (
        <Link href="/account" className={styles.primary}>
          Your account
        </Link>
      ) : (
        <>
          <Link href="/register" className={styles.primary}>
            Create account
          </Link>
          <Link href="/login" className={styles.secondary}>
            Log in
          </Link>
        </>
      )}
    </nav>
  );
}

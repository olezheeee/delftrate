// The bar at the top of the home page: the name on the left, the site's numbers in the
// middle, and the way into an account on the right.
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth/session";
import { getSiteTotals, totalsText, type SiteTotals } from "@/lib/site-totals";
import styles from "./TopBar.module.css";

export function TopBar() {
  return (
    <header className={styles.bar}>
      <Link href="/" className={styles.brand} aria-label="DelftRate home">
        Delft<em>Rate</em>
      </Link>
      {/* The numbers come from the database when a visitor asks for the page. */}
      <Suspense fallback={<Totals totals={null} />}>
        <LiveTotals />
      </Suspense>
      {/* Reads the session, so it is rendered per request behind this boundary. */}
      <Suspense fallback={<div className={styles.account} aria-hidden="true" />}>
        <Account />
      </Suspense>
    </header>
  );
}

async function LiveTotals() {
  // Wait for the request: the numbers are read when a visitor asks for the page, not while
  // the site is built, so the build never needs the database.
  await connection();
  let totals: SiteTotals | null = null;
  try {
    totals = await getSiteTotals();
  } catch (error) {
    // The page works without its numbers.
    console.error("Home page: the site totals could not be read.", error);
  }
  return <Totals totals={totals} />;
}

// With null (still loading, or not available) the three places are kept, so the bar does
// not jump when the numbers arrive.
function Totals({ totals }: { totals: SiteTotals | null }) {
  if (!totals) {
    return (
      <ul className={styles.totals} aria-hidden="true">
        {["votes", "students", "courses"].map((label) => (
          <li key={label}>
            <b>–</b>
            <span>{label}</span>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className={styles.totals} aria-label="DelftRate in numbers">
      {totalsText(totals).map((item) => (
        <li key={item.key}>
          <b>{item.count}</b>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

async function Account() {
  // Wait for the request, as the numbers do. While the site is built there is no visitor,
  // and reading the session then ends in an error that is Next.js's own way of stopping:
  // it must not be caught and logged below as a failure.
  await connection();
  let signedIn = false;
  try {
    signedIn = (await getCurrentUser()) !== null;
  } catch (error) {
    // The page works without knowing who is looking at it: the two links are shown.
    console.error("Home page: the session could not be read.", error);
  }
  return (
    <nav className={styles.account} aria-label="Account">
      {signedIn ? (
        <Link href="/account" className={styles.profile} aria-label="Your account" title="Your account">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
            <circle cx="12" cy="8.5" r="3.6" />
            <path d="M4.8 20c.9-3.6 3.7-5.6 7.2-5.6s6.3 2 7.2 5.6" strokeLinecap="round" />
          </svg>
        </Link>
      ) : (
        <>
          <Link href="/login" className={styles.login}>
            Log in
          </Link>
          <Link href="/register" className={styles.create}>
            <span className={styles.wide}>Create an account</span>
            {/* The smallest phones have no room for the full words. */}
            <span className={styles.narrow}>Sign up</span>
          </Link>
        </>
      )}
    </nav>
  );
}

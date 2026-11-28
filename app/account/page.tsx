import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import styles from "@/app/ui/form.module.css";
import { programmeName } from "@/lib/auth/programmes";
import { getProfile, requireUser } from "@/lib/auth/session";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Your account — DelftRate" };

export default function AccountPage() {
  return (
    <div className={styles.shell}>
      <Link href="/" className={styles.brand}>
        Delft<em>Rate</em>
      </Link>
      <main className={styles.card}>
        <span className="mono">Your account</span>
        {/* Reads the session, so it is rendered per request behind this boundary. */}
        <Suspense fallback={<div className={styles.skeleton} />}>
          <Account />
        </Suspense>
      </main>
    </div>
  );
}

async function Account() {
  const user = await requireUser();
  const profile = await getProfile();

  if (!profile) {
    return (
      <>
        <h1 className={styles.title}>
          Finish your <em>profile.</em>
        </h1>
        <p className={styles.lead}>
          Signed in as <strong>{user.email}</strong>. Tell us your programme and year. The
          programme decides which courses you can rate and cannot be changed later.
        </p>
        <ProfileForm />
        <form action={logout}>
          <p className={styles.footer}>
            <button type="submit" className={styles.textButton}>
              Log out
            </button>
          </p>
        </form>
      </>
    );
  }

  return (
    <>
      <h1 className={styles.title}>
        You are <em>signed in.</em>
      </h1>
      <dl className={styles.details}>
        <div>
          <dt className={styles.label}>Email address</dt>
          <dd>{user.email}</dd>
        </div>
        <div>
          <dt className={styles.label}>Programme</dt>
          <dd>{programmeName(profile.programme_id)}</dd>
        </div>
        <div>
          <dt className={styles.label}>Year</dt>
          <dd>Year {profile.year}</dd>
        </div>
      </dl>
      <form action={logout} className={styles.form}>
        <button type="submit" className={`${styles.button} ${styles.ghost}`}>
          Log out
        </button>
      </form>
    </>
  );
}

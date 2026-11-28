import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { TopBar } from "../_components/TopBar";
import { requireUser } from "@/lib/auth/session";
import { getCourseList } from "@/lib/course-list-data";
import type { CourseListEntry } from "@/lib/course-list";
import { buildBoards } from "@/lib/leaderboards";
import { Boards } from "./Boards";
import styles from "./Leaderboards.module.css";

export const metadata: Metadata = { title: "Leaderboards — DelftRate" };

export default function LeaderboardsPage() {
  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.head}>
          <div>
            <span className="mono">[ 02 ] Leaderboards</span>
            <h1>
              The rankings
              <br />
              <em>everyone argues about.</em>
            </h1>
          </div>
          <p>
            Built from the ratings students have given. Open a row for the full course, or share a
            board and start the argument.
          </p>
        </div>
        {/* Reads the session, so it is rendered per request behind this boundary. */}
        <Suspense fallback={<Skeleton />}>
          <LiveBoards />
        </Suspense>
      </main>
    </div>
  );
}

function Skeleton() {
  return (
    <div className={styles.boards} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className={`${styles.skeleton} ${i < 2 ? styles.xl : ""}`} />
      ))}
    </div>
  );
}

async function LiveBoards() {
  // Wait for the request first, as the top bar does: everything below runs when a visitor
  // asks for the page, not while it is prerendered. Without this the prerender reached the
  // database, Next.js stopped the read when the prerender ended, and the catch below logged
  // that as a failure.
  await connection();
  // Outside any try/catch: the redirect for a visitor who is not signed in must not be
  // swallowed.
  await requireUser();
  let entries: CourseListEntry[];
  try {
    entries = await getCourseList();
  } catch (error) {
    console.error("Leaderboards: the course list could not be read.", error);
    return <p className={styles.unavailable}>The leaderboards are not available right now.</p>;
  }
  return <Boards boards={buildBoards(entries)} />;
}

import type { Metadata } from "next";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import type { CourseListEntry } from "@/lib/course-list";
import { getCourseList } from "@/lib/course-list-data";
import { TopBar } from "../_components/TopBar";
import { CourseList } from "./CourseList";
import styles from "./CourseList.module.css";

export const metadata: Metadata = { title: "Courses — DelftRate" };

export default function CoursesPage() {
  return (
    <div className={styles.page}>
      <TopBar />
      <main className={styles.main}>
        <div className={styles.head}>
          <div>
            <span className="mono">[ 01 ] Courses</span>
            <h1 className={styles.title}>
              Subject plus professor.
              <br />
              <em>One honest number.</em>
            </h1>
          </div>
          <p className={styles.lede}>
            Every course is rated twice: on the subject itself and on its professor. The single
            number on each card is how hard the course is overall, from 0 to 10, where higher is
            harder. Open a card to see both ratings.
          </p>
        </div>
        {/* Reads the session, so it is rendered per request. */}
        <Suspense fallback={<ListSkeleton />}>
          <Courses />
        </Suspense>
      </main>
    </div>
  );
}

function ListSkeleton() {
  return (
    <div aria-hidden="true">
      <div className={styles.skeletonBar} />
      <div className={styles.grid}>
        {[0, 1, 2].map((i) => (
          <div key={i} className={styles.skeletonCard} />
        ))}
      </div>
    </div>
  );
}

async function Courses() {
  // Outside any try/catch: the redirect for a visitor who is not signed in, and Next.js's own
  // signal while the site is built, must not be swallowed.
  await requireUser();
  let entries: CourseListEntry[];
  try {
    entries = await getCourseList();
  } catch (error) {
    console.error("Courses page: the course list could not be read.", error);
    return <p className={styles.notice}>Course data is not available right now.</p>;
  }
  return <CourseList entries={entries} />;
}

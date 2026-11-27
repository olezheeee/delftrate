import Link from "next/link";
import { Suspense } from "react";
import { getCurrentUser, getProfile } from "@/lib/auth/session";
import { parseChoice, type CalendarCourse } from "@/lib/calendar";
import { getCalendarCourses } from "@/lib/courses";
import { CourseCalendar } from "./_components/CourseCalendar";
import calendarStyles from "./_components/CourseCalendar.module.css";
import styles from "./page.module.css";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <main className={styles.main}>
      <header className={styles.head}>
        <span className="mono">DelftRate · Courses</span>
        <h1 className={styles.title}>
          Know your course before the <em>first lecture.</em>
        </h1>
        <p className={styles.lead}>
          Pick your programme and year to see the whole year laid out by quarter. Open a
          course to read what students think of it.
        </p>
        {/* Reads the session, so it is rendered per request behind this boundary. */}
        <Suspense fallback={<nav className={styles.nav} aria-hidden="true" />}>
          <AccountLinks />
        </Suspense>
      </header>
      {/* Reads the address and the session, so it is rendered per request as well. */}
      <Suspense fallback={<CalendarSkeleton />}>
        <Calendar searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

function CalendarSkeleton() {
  return (
    <div className={calendarStyles.skeleton} aria-hidden="true">
      <div className={calendarStyles.skeletonPills} />
      <div className={calendarStyles.skeletonGrid} />
    </div>
  );
}

async function Calendar({ searchParams }: { searchParams: PageProps<"/">["searchParams"] }) {
  // Wait for the request first: everything below runs when a visitor asks for the page, not
  // while the site is built, so the build never needs the database.
  let choice = parseChoice(await searchParams);

  // The course list is public and cached. Start it now so it loads while the session is
  // read; a failure is handled here, and the calendar then says the data is not available.
  const loading: Promise<CalendarCourse[] | null> = getCalendarCourses().catch((error) => {
    console.error("Home page: the courses could not be loaded.", error);
    return null;
  });

  let signedIn = false;
  try {
    signedIn = (await getCurrentUser()) !== null;
    // An address that names no programme leaves the choice to the user's own profile.
    if (signedIn && !choice.programme) {
      const profile = await getProfile();
      if (profile) choice = parseChoice({ programme: profile.programme_id, year: profile.year });
    }
  } catch (error) {
    // The calendar works without knowing who is looking at it.
    console.error("Home page: the session or profile could not be read.", error);
  }

  return <CourseCalendar courses={await loading} initial={choice} signedIn={signedIn} />;
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

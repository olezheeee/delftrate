import { Suspense } from "react";
import { getCurrentUser, getProfile } from "@/lib/auth/session";
import { parseChoice, type CalendarCourse } from "@/lib/calendar";
import { getCalendarScores, RATINGS_WAIT_MS, within, type CalendarScores } from "@/lib/calendar-scores";
import { getCalendarCourses } from "@/lib/courses";
import { BackgroundVideo } from "./_components/BackgroundVideo";
import { CourseCalendar } from "./_components/CourseCalendar";
import calendarStyles from "./_components/CourseCalendar.module.css";
import { TopBar } from "./_components/TopBar";
import styles from "./page.module.css";

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <>
      <BackgroundVideo />
      <div className={styles.page}>
        <TopBar />
        <main className={styles.main}>
          <h1 className={styles.sr}>DelftRate course calendar</h1>
          {/* Reads the address and the session, so it is rendered per request. */}
          <Suspense fallback={<CalendarSkeleton />}>
            <Calendar searchParams={searchParams} />
          </Suspense>
        </main>
      </div>
    </>
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
  // The ratings next to each course, public and cached like the list. Without them the
  // calendar still shows the courses, so it waits for them only so long.
  const scores: Promise<CalendarScores | null> = within(getCalendarScores(), RATINGS_WAIT_MS).catch(
    (error) => {
      console.error("Home page: the ratings could not be loaded.", error);
      return null;
    },
  );

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

  return (
    <CourseCalendar courses={await loading} scores={await scores} initial={choice} signedIn={signedIn} />
  );
}

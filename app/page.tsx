import { Suspense } from "react";
import { CourseCalendar } from "./_components/CourseCalendar";
import { parseChoice, type Choice } from "@/lib/calendar";
import { getCalendarCourses, getProgrammes, type Programme } from "@/lib/courses";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnv } from "@/lib/supabase/env";
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
          Pick your programme and year to see the whole bachelor laid out by
          quarter. Open a course to read what students think.
        </p>
      </header>
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarLoader searchParams={searchParams} />
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

// Reads request data (search params, cookies), so it renders at request time.
// No Supabase call happens while the app is built.
async function CalendarLoader({
  searchParams,
}: {
  searchParams: PageProps<"/">["searchParams"];
}) {
  const params = await searchParams;
  let choice: Choice = parseChoice(params);

  let configured = true;
  try {
    supabaseEnv();
  } catch {
    configured = false;
  }

  if (!configured) {
    return (
      <CourseCalendar
        courses={null}
        programmes={[]}
        initial={choice}
        signedIn={false}
      />
    );
  }

  // Start the (cached, public) course data first, so it loads while the sign-in is checked.
  const data = Promise.all([getCalendarCourses(), getProgrammes()]);
  // Handled below; this keeps a failure from being reported as unhandled while auth runs.
  data.catch(() => {});

  let signedIn = false;
  const supabase = await createClient();
  try {
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      signedIn = true;
      // A URL without a programme (also /?year=2) does not pick a calendar, so the
      // user's own programme and year apply.
      if (!choice.programme) {
        // profiles.id is the auth user id (it references auth.users).
        const { data: profile } = await supabase
          .from("profiles")
          .select("programme_id, year")
          .eq("id", auth.user.id)
          .maybeSingle();
        if (profile) {
          // parseChoice drops a programme or year the calendar does not show.
          choice = parseChoice({
            programme: profile.programme_id,
            year: String(profile.year),
          });
        }
      }
    }
  } catch (error) {
    // The calendar still works without the profile.
    console.error("Home page: could not read the signed-in user's profile", error);
  }

  let courses = null;
  let programmes: Programme[] = [];
  try {
    [courses, programmes] = await data;
  } catch (error) {
    console.error("Home page: could not load the course calendar", error);
    courses = null;
  }

  return (
    <CourseCalendar
      courses={courses}
      programmes={programmes}
      initial={choice}
      signedIn={signedIn}
    />
  );
}

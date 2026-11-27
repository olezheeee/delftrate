"use client";

// The course schedule calendar of the home page: pick a programme, then a year, and see
// that year's courses under the quarters they run in.
import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { PROGRAMMES, YEARS, programmeName } from "@/lib/auth/programmes";
import {
  courseHref,
  layoutCalendar,
  type CalendarCourse,
  type Choice,
  type Placed,
} from "@/lib/calendar";
import styles from "./CourseCalendar.module.css";

const QUARTERS = [1, 2, 3, 4];

// CSS grid lines count from 1; `offset` skips rows above the blocks (the quarter names).
function cell(placed: Placed<unknown>, offset = 0): CSSProperties {
  return {
    gridColumn: `${placed.column + 1} / span ${placed.span}`,
    gridRow: `${placed.row + 1 + offset} / span ${placed.height}`,
  };
}

function quarterLabel(quarters: number[]): string {
  const first = Math.min(...quarters);
  const last = Math.max(...quarters);
  return first === last ? `Quarter ${first}` : `Quarters ${first} to ${last}`;
}

export function CourseCalendar({
  courses,
  initial,
  signedIn,
}: {
  // null when the courses could not be loaded.
  courses: CalendarCourse[] | null;
  initial: Choice;
  signedIn: boolean;
}) {
  const [choice, setChoice] = useState<Choice>(initial);

  function choose(next: Choice) {
    setChoice(next);
    // Keep the choice in the address, so the page can be reloaded or shared. This does not
    // load anything: every course is already here.
    const params = new URLSearchParams();
    if (next.programme) params.set("programme", next.programme);
    if (next.programme && next.year) params.set("year", String(next.year));
    const query = params.toString();
    window.history.replaceState(null, "", query ? `?${query}` : window.location.pathname);
  }

  const layout = useMemo(() => {
    if (!courses || !choice.programme || !choice.year) return null;
    return layoutCalendar(
      courses.filter((c) => c.programme === choice.programme && c.year === choice.year),
    );
  }, [courses, choice]);

  const listed = layout
    ? layout.blocks.reduce((sum, block) => sum + block.item.courses.length, 0)
    : 0;

  return (
    <section className={styles.calendar} aria-label="Course schedule">
      <div className={styles.steps}>
        <div className={styles.step}>
          <span className="mono" id="calendar-programme">
            1 · Programme
          </span>
          <div className={styles.pills} role="group" aria-labelledby="calendar-programme">
            {PROGRAMMES.map((programme) => (
              <button
                key={programme.id}
                type="button"
                className={styles.pill}
                aria-pressed={choice.programme === programme.id}
                onClick={() => choose({ programme: programme.id, year: choice.year })}
              >
                {programme.name}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.step} data-waiting={choice.programme ? undefined : ""}>
          <span className="mono" id="calendar-year">
            2 · Year
          </span>
          <div className={styles.pills} role="group" aria-labelledby="calendar-year">
            {YEARS.map((year) => (
              <button
                key={year}
                type="button"
                className={styles.pill}
                aria-pressed={choice.programme !== null && choice.year === year}
                disabled={!choice.programme}
                onClick={() => choose({ programme: choice.programme, year })}
              >
                Bachelor {year}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Only this short line is read out when the choice changes. With the grid inside it, a
          screen reader would read every course of the year after each press of a pill. */}
      <div aria-live="polite">
        {courses === null ? (
          <p className={styles.message}>
            Course data is not available right now. Try again in a moment.
          </p>
        ) : !choice.programme ? (
          <p className={styles.message}>Pick your programme to see its courses.</p>
        ) : !choice.year ? (
          <p className={styles.message}>
            Now pick a year of {programmeName(choice.programme)}.
          </p>
        ) : layout && layout.rows > 0 ? (
          <p className={styles.announce}>
            {listed} {listed === 1 ? "course" : "courses"} in year {choice.year} of{" "}
            {programmeName(choice.programme)}.
          </p>
        ) : (
          <p className={styles.message}>
            No courses are listed for year {choice.year} of {programmeName(choice.programme)} yet.
          </p>
        )}
      </div>

      {layout && layout.rows > 0 && (
        // The key restarts the entrance animation when the choice changes.
        <div className={styles.scroll} key={`${choice.programme}-${choice.year}`}>
          <div
            className={styles.grid}
            style={{ gridTemplateRows: `auto repeat(${layout.rows}, minmax(84px, auto))` }}
          >
            {QUARTERS.map((quarter) => (
              <div
                key={quarter}
                className={styles.lane}
                style={{ gridColumn: quarter, gridRow: `1 / span ${layout.rows + 1}` }}
              />
            ))}
            {/* The names sit in a row of their own: a lane spans every row, so it cannot
                give the first row its height. */}
            {QUARTERS.map((quarter) => (
              <span
                key={quarter}
                className={`mono ${styles.quarter}`}
                style={{ gridColumn: quarter, gridRow: 1 }}
              >
                Q{quarter}
              </span>
            ))}
            {layout.blocks.map((block, index) => {
              const { item } = block;
              const style = { ...cell(block, 1), "--i": index } as CSSProperties;
              if (!item.isModule) {
                return (
                  <CourseLink
                    key={item.code}
                    course={item.courses[0].item}
                    signedIn={signedIn}
                    className={`${styles.block} ${styles.course}`}
                    style={style}
                  />
                );
              }
              return (
                <div key={item.code} className={`${styles.block} ${styles.module}`} style={style}>
                  <span className={styles.moduleCode}>{item.code}</span>
                  <div
                    className={styles.parts}
                    style={{
                      gridTemplateColumns: `repeat(${block.span}, minmax(0, 1fr))`,
                    }}
                  >
                    {item.courses.map((part) => (
                      <CourseLink
                        key={part.item.code}
                        course={part.item}
                        signedIn={signedIn}
                        className={`${styles.course} ${styles.part}`}
                        style={cell(part)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {layout && layout.rows > 0 && !signedIn && (
        <p className={styles.hint}>Opening a course asks you to log in first.</p>
      )}
    </section>
  );
}

function CourseLink({
  course,
  signedIn,
  className,
  style,
}: {
  course: CalendarCourse;
  signedIn: boolean;
  className: string;
  style: CSSProperties;
}) {
  return (
    // No prefetch: the course sheet needs an account, and for a signed-out visitor every
    // prefetch would only be answered with the login page.
    <Link
      href={courseHref(course.code, signedIn)}
      prefetch={false}
      className={className}
      style={style}
      aria-label={`${course.code} ${course.name}, ${quarterLabel(course.quarters).toLowerCase()}`}
    >
      <span className={styles.code}>{course.code}</span>
      <span className={styles.name}>{course.name}</span>
    </Link>
  );
}

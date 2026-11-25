"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useMemo, type CSSProperties } from "react";
import {
  PROGRAMMES,
  YEARS,
  layoutCalendar,
  parseChoice,
  type CalendarCourse,
  type Choice,
  type ProgrammeCode,
  type Year,
} from "@/lib/calendar";
import type { Programme } from "@/lib/courses";
import styles from "./CourseCalendar.module.css";

// Shown when the programmes could not be loaded (no Supabase configured, or an outage), so
// the pickers still read well. The database is the source of the names otherwise.
const FALLBACK_NAMES: Record<ProgrammeCode, string> = {
  AE: "Aerospace Engineering",
  CSE: "Computer Science and Engineering",
};

type Props = {
  // null = course data could not be loaded
  courses: CalendarCourse[] | null;
  programmes: Programme[];
  initial: Choice;
  signedIn: boolean;
};

export function CourseCalendar({ courses, programmes, initial, signedIn }: Props) {
  // The URL is the one source of truth for the choice, so the address bar and the calendar
  // can never disagree (after Back, a refresh or a link to /?programme=…). replaceState
  // below updates useSearchParams without a navigation. With nothing in the URL, a signed-in
  // user starts on their own programme and year (`initial`, from the server).
  const searchParams = useSearchParams();
  const fromUrl = parseChoice(searchParams);
  // A year alone (/?year=2) picks no calendar, so it does not override the user's own.
  const choice: Choice = fromUrl.programme ? fromUrl : initial;
  const groupId = useId();

  const nameOf = (code: ProgrammeCode) =>
    programmes.find((p) => p.id === code)?.name ?? FALLBACK_NAMES[code];

  function update(next: Choice) {
    // Keep the choice in the URL without a navigation. Other parameters and the #anchor
    // stay as they were.
    const params = new URLSearchParams(window.location.search);
    if (next.programme) params.set("programme", next.programme);
    else params.delete("programme");
    if (next.year) params.set("year", String(next.year));
    else params.delete("year");
    const qs = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`,
    );
  }

  const layout = useMemo(
    () =>
      courses && choice.programme && choice.year
        ? layoutCalendar(courses, choice.programme, choice.year)
        : null,
    [courses, choice.programme, choice.year],
  );

  return (
    <section className={styles.root} aria-label="Course schedule">
      <div className={styles.pickers}>
        <fieldset className={styles.group}>
          <legend className="mono">1 · Programme</legend>
          <div className={styles.pills}>
            {PROGRAMMES.map((code) => (
              <label key={code} className={styles.pill}>
                <input
                  type="radio"
                  name={`${groupId}-programme`}
                  value={code}
                  checked={choice.programme === code}
                  onChange={() => update({ ...choice, programme: code })}
                />
                <span>{nameOf(code)}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className={styles.group} disabled={!choice.programme}>
          <legend className="mono">2 · Year</legend>
          <div className={styles.pills}>
            {YEARS.map((y) => (
              <label key={y} className={styles.pill}>
                <input
                  type="radio"
                  name={`${groupId}-year`}
                  value={y}
                  checked={choice.year === y}
                  onChange={() => update({ ...choice, year: y as Year })}
                />
                <span>Bachelor {y}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {courses === null ? (
        <p className={styles.note} role="status">
          Course data is not available right now.
        </p>
      ) : !layout ? (
        <p className={styles.note}>
          {choice.programme
            ? "Now pick your year to see the calendar."
            : "Pick your programme to begin."}
        </p>
      ) : (
        <div
          // Re-mount on change so the calendar fades in again.
          key={`${choice.programme}-${choice.year}`}
          className={styles.calendar}
        >
          <div className={styles.scroller}>
            <div className={styles.board}>
              <div className={styles.head} aria-hidden="true">
                {[1, 2, 3, 4].map((q) => (
                  <span key={q} className="mono">
                    Q{q}
                  </span>
                ))}
              </div>
              <ul
                className={styles.grid}
                style={{ "--lanes": Math.max(layout.lanes, 1) } as CSSProperties}
                aria-label={`${choice.programme} bachelor year ${choice.year}`}
              >
                {layout.placements.map((p, i) => {
                  const code = p.course.code;
                  const href = signedIn
                    ? `/courses/${encodeURIComponent(code)}`
                    : `/login?next=${encodeURIComponent(`/courses/${encodeURIComponent(code)}`)}`;
                  return (
                    <li
                      key={`${code}-${p.start}`}
                      className={styles.cell}
                      style={
                        {
                          gridColumn: `${p.start} / span ${p.span}`,
                          gridRow: p.lane + 1,
                          "--i": i,
                        } as CSSProperties
                      }
                    >
                      {/* No prefetch: the course sheet (Pack 4, Ariv) and login (Pack 2)
                          do not exist yet, and a calendar has many links. Turn it back on
                          once both pages are built. */}
                      <Link href={href} prefetch={false} className={styles.course}>
                        <span className={`mono ${styles.code}`}>{code}</span>
                        <span className={styles.name}>{p.course.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {layout.placements.length === 0 && (
                <p className={styles.empty}>No courses here yet.</p>
              )}
            </div>
          </div>
          {layout.unplaced > 0 && (
            <p className={styles.unplaced}>
              {layout.unplaced}{" "}
              {layout.unplaced === 1 ? "course" : "courses"} without a known
              quarter yet
            </p>
          )}
        </div>
      )}
    </section>
  );
}

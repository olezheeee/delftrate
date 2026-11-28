"use client";

// The course schedule calendar of the home page: pick a programme, then a year, and see
// that year's courses under the quarters they run in, each with its ratings: the overall
// difficulty as "5.4/10", and under it two circles for the subject's load and the professor.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMemo, useState, type CSSProperties } from "react";
import { PROGRAMMES, YEARS, programmeName } from "@/lib/auth/programmes";
import {
  courseHref,
  difficultyColour,
  layoutCalendar,
  LOAD_SCALE,
  loadColour,
  teachColour,
  parseChoice,
  type CalendarCourse,
  type Choice,
  type CourseNumbers,
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

const NOT_RATED: CourseNumbers = { score: null, load: null, teach: null };

const CIRCLES = [
  { kind: "score", name: "Difficulty" },
  { kind: "load", name: "Subject load" },
  { kind: "teach", name: "Professor" },
] as const satisfies readonly { kind: keyof CourseNumbers; name: string }[];

// One decimal, as on the course's own page. A full 10 is written without it: "10.0" does
// not fit in a small circle.
function tenth(value: number): string {
  const text = value.toFixed(1);
  return text === "10.0" ? "10" : text;
}

// For a screen reader, which gets the numbers in the link's name instead of the circles.
function ratingText(numbers: CourseNumbers): string {
  const parts = CIRCLES.flatMap(({ kind, name }) => {
    const value = numbers[kind];
    return value === null ? [] : [`${name.toLowerCase()} ${tenth(value)}`];
  });
  return parts.length > 0 ? `${parts.join(", ")} out of 10` : "not rated yet";
}

// The choice an address names. An address that names no programme leaves it to what the
// server sent: nothing, or the programme and year of the user's own profile.
function choiceOf(address: string, sent: Choice): Choice {
  const params = new URLSearchParams(address);
  const named = parseChoice({ programme: params.get("programme"), year: params.get("year") });
  return named.programme ? named : sent;
}

export function CourseCalendar({
  courses,
  scores,
  initial,
  signedIn,
}: {
  // null when the courses could not be loaded.
  courses: CalendarCourse[] | null;
  // The numbers of each rated course, by course code. null when they could not be loaded:
  // the calendar then shows the courses without circles.
  scores: Record<string, CourseNumbers> | null;
  initial: Choice;
  signedIn: boolean;
}) {
  // What is shown is what the address names, from the start and whenever the address
  // changes. The pills write their choice to the address themselves (see choose); the rest
  // is for an address that changes some other way, such as a click on the name in the bar,
  // which leads to "/", and for a page that comes back with an older answer of the server.
  const address = useSearchParams().toString();
  const [choice, setChoice] = useState<Choice>(() => choiceOf(address, initial));
  const [seen, setSeen] = useState({ address, initial });
  if (seen.address !== address || seen.initial !== initial) {
    setSeen({ address, initial });
    setChoice(choiceOf(address, initial));
  }

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

  const numbersOf = (code: string): CourseNumbers | null => scores && (scores[code] ?? NOT_RATED);

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

      {/* What the numbers of a course are. */}
      {layout && layout.rows > 0 && (scores ? (
        <p className={styles.legend}>
          <span className={styles.legendItem}>
            Difficulty, from the easiest (1)
            <span
              className={styles.scale}
              style={{ background: `linear-gradient(to right, ${LOAD_SCALE.join(", ")})` }}
              aria-hidden="true"
            />
            to the hardest (10)
          </span>
          {CIRCLES.filter(({ kind }) => kind !== "score").map(({ kind, name }) => (
            <span key={kind} className={styles.legendItem}>
              <span className={styles.swatch} data-kind={kind} aria-hidden="true" />
              {name}
            </span>
          ))}
          <span>Blue: a light subject, a strong professor. A dash: too few votes so far.</span>
        </p>
      ) : (
        <p className={styles.hint}>The ratings are not available right now. Try again in a moment.</p>
      ))}

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
                    numbers={numbersOf(item.courses[0].item.code)}
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
                        numbers={numbersOf(part.item.code)}
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
  numbers,
  signedIn,
  className,
  style,
}: {
  course: CalendarCourse;
  // null when the ratings could not be loaded: the course is shown without circles.
  numbers: CourseNumbers | null;
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
      aria-label={
        `${course.code} ${course.name}, ${quarterLabel(course.quarters).toLowerCase()}` +
        (numbers ? `, ${ratingText(numbers)}` : "")
      }
    >
      <span className={styles.text}>
        <span className={styles.code}>{course.code}</span>
        <span className={styles.name}>{course.name}</span>
      </span>
      {numbers && (
        // The overall score on top; under it the subject's load and the professor.
        <span className={styles.scores}>
          <Overall score={numbers.score} />
          <span className={styles.pair}>
            <Ring kind="load" value={numbers.load} />
            <Ring kind="teach" value={numbers.teach} />
          </span>
        </span>
      )}
    </Link>
  );
}

// The overall difficulty of the course, written as "5.4/10": 1 is the easiest course, 10
// one that is impossible to pass. The number takes its own colour: the site's blue for an
// easy course, white in between, a warm tone for a hard one (difficultyColour), so the
// colour never says anything the number does not.
function Overall({ score }: { score: number | null }) {
  const text = score === null ? null : tenth(score);
  return (
    <span
      className={styles.overall}
      data-empty={text === null ? "" : undefined}
      title={
        text === null
          ? "Difficulty: too few votes so far"
          : `Difficulty: ${text} out of 10. 1 is the easiest course, 10 the hardest.`
      }
      style={score === null ? undefined : ({ "--tone": difficultyColour(score) } as CSSProperties)}
    >
      <b aria-hidden="true">{text ?? "–"}</b>
      <span aria-hidden="true">/10</span>
    </span>
  );
}

// One circle: a ring filled as far as the number goes (out of 10), with the number inside.
// Empty with a dash while there are too few votes. The number takes the colour of what it
// says: blue for a light subject or a strong professor, warm for the opposite.
function Ring({ kind, value }: { kind: "load" | "teach"; value: number | null }) {
  const name = CIRCLES.find((circle) => circle.kind === kind)!.name;
  const text = value === null ? null : tenth(value);
  const title = text === null ? `${name}: too few votes so far` : `${name}: ${text} out of 10`;
  const colour = value === null ? null : kind === "load" ? loadColour(value) : teachColour(value);
  return (
    <span
      className={styles.ring}
      data-kind={kind}
      data-empty={text === null ? "" : undefined}
      title={title}
      style={colour ? ({ "--tone": colour } as CSSProperties) : undefined}
    >
      <svg viewBox="0 0 36 36" aria-hidden="true">
        <circle className={styles.track} cx="18" cy="18" r="16" />
        {value !== null && (
          <circle
            className={styles.arc}
            cx="18"
            cy="18"
            r="16"
            // The circle counts as 100 long, so a 7.4 fills 74 of it.
            pathLength={100}
            strokeDasharray={`${Math.min(Math.max(value, 0), 10) * 10} 100`}
          />
        )}
      </svg>
      <b aria-hidden="true">{text ?? "–"}</b>
    </span>
  );
}

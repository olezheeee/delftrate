"use client";

// The card of one course: the combined score that counts up, the rank tiles, the professor
// switcher, the subject and professor bars, the study plan, Resources, and the rating game
// (rating dials, a progress strip, a lighthouse that lights one window per rated dial, and
// fireworks when the rating is posted).
//
// Between the professor block and the dials sits "Resources" (Resources.tsx): the study
// material and the two booklets of the course.
//
// Still to do (Pack 5): posting the rating through submit_rating().
import Link from "next/link";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
} from "react";
import { programmeName } from "@/lib/auth/programmes";
import { studyPlan, type CourseRanks, type Rank } from "@/lib/course-insights";
import type { CourseDetails } from "@/lib/course-sheet-data";
import { PROFESSOR_CRITERIA, SUBJECT_CRITERIA, type CourseSheet } from "@/lib/course-sheet";
import type { CourseResources } from "@/lib/resources";
import { VERDICT_LABELS, type Verdict } from "@/lib/score";
import { BeamDial } from "./BeamDial";
import { Fireworks } from "./Fireworks";
import { Lighthouse } from "./Lighthouse";
import styles from "./CourseCard.module.css";
import { Resources, type BookletSummary } from "./Resources";

const MIN_VOTES_NOTE = "Not enough votes yet";
const COUNT_MS = 900;

// The colour of the dot next to each verdict.
const VERDICT_COLOURS: Record<Verdict, string> = {
  "hard-well-taught": "#7fd0f7",
  "brace-yourself": "#ff9d8a",
  "smooth-ride": "#8fe0b0",
  "manageable-solo": "#f2b46a",
};

function one(value: number): string {
  return value.toFixed(1);
}

// "Q2", "Q1–Q3" for quarters in a row, "Q1, Q3" when one is skipped: a range would suggest
// the course runs in Q2 as well.
function quartersText(quarters: number[]): string {
  if (quarters.length === 0) return "";
  const sorted = [...quarters].sort((a, b) => a - b);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  if (first === last) return `Q${first}`;
  const inARow = sorted.every((q, i) => i === 0 || q === sorted[i - 1] + 1);
  return inARow ? `Q${first}–Q${last}` : sorted.map((q) => `Q${q}`).join(", ");
}

// cubic-bezier(0.22, 1, 0.36, 1), the curve of the whole card, solved for progress t.
function easeOut(t: number): number {
  const [x1, y1, x2, y2] = [0.22, 1, 0.36, 1];
  const at = (a: number, b: number, s: number) => 3 * a * (1 - s) ** 2 * s + 3 * b * (1 - s) * s ** 2 + s ** 3;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    if (at(x1, x2, mid) < t) lo = mid;
    else hi = mid;
  }
  return at(y1, y2, (lo + hi) / 2);
}

// Counts from the value it showed before to `target`. Under reduced motion it jumps at once.
function useCountUp(target: number | null): number {
  // Starts at the target, so the server HTML already shows the real score.
  const [value, setValue] = useState(target ?? 0);
  const shown = useRef(target ?? 0);
  useEffect(() => {
    if (target === null || target === shown.current) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = shown.current;
    const start = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      const t = reduced ? 1 : Math.min(1, (now - start) / COUNT_MS);
      // The last frame is the target itself: the sum can end a hair beside it, which would
      // round to another tenth.
      shown.current = t < 1 ? from + (target - from) * easeOut(t) : target;
      setValue(shown.current);
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target]);
  return value;
}

// The big number while it counts. A component of its own, so only this number renders again on
// every frame of the count, not the whole card with its six dials.
function CountUp({ target }: { target: number }) {
  return <>{one(useCountUp(target))}</>;
}

// True from the first moment the element is on screen, and stays true.
function useInViewOnce<T extends Element>() {
  // A callback ref in state, so the effect runs again when the element appears later.
  const [element, ref] = useState<T | null>(null);
  const [seen, setSeen] = useState(false);
  // Before the first paint of the hydrated page: a block that is already on screen is marked
  // seen right away, so it keeps its final state and never plays the grow-in. Blocks below the
  // fold wait for the observer below.
  useLayoutEffect(() => {
    if (!element || seen) return;
    const box = element.getBoundingClientRect();
    // Deliberate: the re-render must happen before paint, which an observer callback cannot do.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (box.top < window.innerHeight && box.bottom > 0) setSeen(true);
  }, [element, seen]);
  useEffect(() => {
    if (!element || seen) return;
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setSeen(true));
      return () => cancelAnimationFrame(frame);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [element, seen]);
  return [ref, seen] as const;
}

type Criterion = { key: string; label: string; hint: string };

// The averages of one block as bars, or the vote count while there are too few votes.
function Averages({
  criteria,
  averages,
  votes,
}: {
  criteria: readonly Criterion[];
  averages: Record<string, number> | null;
  votes: number;
}) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} data-seen={seen ? "" : undefined}>
      {averages ? (
        <dl className={styles.bars}>
          {criteria.map((criterion) => (
            <div key={criterion.key} className={`${styles.bar} ${styles.target}`} data-beam-target>
              <dt className={styles.body2}>{criterion.label}</dt>
              <dd className={`${styles.hint} ${styles.caption}`}>{criterion.hint}</dd>
              <dd className={styles.barLine}>
                <span className={styles.track} aria-hidden="true">
                  <span
                    className={styles.fill}
                    style={{ "--v": averages[criterion.key] / 10 } as CSSProperties}
                  />
                </span>
                <b className={`${styles.mono} ${styles.body2}`}>{one(averages[criterion.key])}</b>
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className={`${styles.waiting} ${styles.body2}`}>
          {MIN_VOTES_NOTE} · {votes} {votes === 1 ? "vote" : "votes"} so far
        </p>
      )}
    </div>
  );
}

// One rank tile. A missing value shows a dash and says why.
function Tile({
  value,
  of,
  caption,
  note = MIN_VOTES_NOTE,
}: {
  value: number | null;
  of?: number;
  caption: string;
  note?: string;
}) {
  const known = value !== null;
  return (
    <li className={`${styles.tile} ${styles.target}`} data-beam-target>
      <span className={`${styles.tileValue} ${styles.mono} ${styles.title1}`}>
        {known ? `${of === undefined ? value : `#${value}`}${of === undefined ? "%" : ""}` : "–"}
        {known && of !== undefined && <small className={styles.caption}> of {of}</small>}
      </span>
      <span className={`${styles.tileCaption} ${styles.caption}`}>{known ? caption : note}</span>
      {!known && <span className={styles.srOnly}>{caption}</span>}
    </li>
  );
}

function rankTile(rank: Rank | undefined, caption: string, note?: string) {
  return <Tile value={rank?.rank ?? null} of={rank?.of} caption={caption} note={note} />;
}

const NO_PROFESSOR_NOTE = "No professor listed yet";

// The professor switcher: one radio group with a highlight that slides under the choice.
function Switcher({
  professors,
  selected,
  onSelect,
}: {
  professors: { id: string; name: string }[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const group = useRef<HTMLDivElement>(null);
  const highlight = useRef<HTMLSpanElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(
    0,
    professors.findIndex((p) => p.id === selected),
  );

  // Writes straight to the highlight: only its transform moves, so React need not re-render.
  useLayoutEffect(() => {
    const place = () => {
      const target = radios.current[index];
      const mark = highlight.current;
      if (!target || !mark) return;
      // Top and height too: on a phone the buttons wrap onto more lines.
      mark.style.width = `${target.offsetWidth}px`;
      mark.style.height = `${target.offsetHeight}px`;
      mark.style.transform = `translate(${target.offsetLeft}px, ${target.offsetTop}px)`;
    };
    place();
    const frame = requestAnimationFrame(() => {
      if (highlight.current) highlight.current.dataset.ready = "";
    });
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(place);
    if (group.current) observer?.observe(group.current);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [index, professors]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // With Alt, Ctrl or Cmd the arrows are the browser's own shortcuts (back, forward).
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const last = professors.length - 1;
    let next = index;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else return;
    event.preventDefault();
    onSelect(professors[next].id);
    radios.current[next]?.focus();
  };

  return (
    <div className={styles.switchScroll}>
      <div
        ref={group}
        className={styles.switcher}
        role="radiogroup"
        aria-label="Professor"
        onKeyDown={onKeyDown}
      >
        <span ref={highlight} className={styles.highlight} aria-hidden="true" />
        {professors.map((p, i) => (
          <button
            key={p.id}
            ref={(element) => {
              radios.current[i] = element;
            }}
            type="button"
            role="radio"
            aria-checked={p.id === selected}
            tabIndex={p.id === selected ? 0 : -1}
            className={`${styles.radio} ${styles.body2}`}
            onClick={() => onSelect(p.id)}
          >
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CourseCard({
  course,
  sheet,
  resources,
  booklets,
  ranks,
}: {
  course: CourseDetails;
  sheet: CourseSheet;
  resources: CourseResources | null;
  booklets: BookletSummary;
  ranks: CourseRanks;
}) {
  const [professorId, setProfessorId] = useState(sheet.startProfessorId);
  const [rating, setRating] = useState<Record<string, number>>({});
  const [burst, setBurst] = useState(0);
  // The professor the rating was posted for, so the ready message never shows for another one.
  const [submittedFor, setSubmittedFor] = useState<string | null>(null);
  const card = useRef<HTMLElement>(null);
  // Hidden start states (bars, tips) apply only once this runs, so no JavaScript shows the final
  // state. A layout effect, so it runs in the same frame as the in-view check of the blocks and
  // nothing on screen is first hidden and then grown back.
  useLayoutEffect(() => {
    card.current?.setAttribute("data-js", "");
  }, []);

  const professor = sheet.professors.find((p) => p.id === professorId) ?? null;
  const combined = professor?.combined ?? null;
  // A professor's three values are kept under that professor, so they stay behind when
  // another professor is picked.
  const professorKey = (criterion: Criterion) => `${professor?.id}:${criterion.key}`;
  const keys = [
    ...SUBJECT_CRITERIA.map((criterion) => criterion.key),
    ...(professor ? PROFESSOR_CRITERIA.map(professorKey) : []),
  ];
  const left = keys.filter((key) => rating[key] === undefined).length;
  const rated = keys.length - left;
  const total = keys.length;
  const complete = total > 0 && left === 0;
  // "" stands for a course without a professor, so its rating can be submitted too.
  const submitted = submittedFor !== null && submittedFor === (professor?.id ?? "");
  const set = (key: string) => (value: number) => {
    setSubmittedFor(null);
    setRating((current) => ({ ...current, [key]: value }));
  };

  const plan =
    sheet.subject.averages && professor?.averages ? studyPlan(sheet.subject.averages, professor.averages) : null;
  const [tipsRef, tipsSeen] = useInViewOnce<HTMLDivElement>();

  return (
    <main ref={card} className={styles.card}>
      <Lighthouse windows={total} lit={rated} complete={complete} className={styles.lighthouse} />
      <Fireworks burst={burst} />

      <header className={styles.head}>
        <Link href={`/?programme=${course.programme}&year=${course.year}`} className={`${styles.back} ${styles.body2}`}>
          ← Calendar
        </Link>
        <p className={`${styles.meta} ${styles.caption}`}>
          {course.code} · {programmeName(course.programme)} · Year {course.year}
          {course.quarters.length > 0 && ` · ${quartersText(course.quarters)}`}
        </p>
        <h1 className={`${styles.title} ${styles.heading1}`}>{course.name}</h1>
      </header>

      <section className={styles.score} aria-label="Overall difficulty">
        {/* Always in the page, so a change of text is announced when the professor changes. The
            count is for the eyes; screen readers hear the final score once. */}
        <span className={styles.srOnly} aria-live="polite">
          {combined
            ? `Difficulty ${one(combined.score)} out of 10, ${VERDICT_LABELS[combined.verdict]}`
            : "No difficulty score yet"}
        </span>
        {combined ? (
          <>
            <p className={`${styles.scoreLabel} ${styles.mono} ${styles.caption}`}>
              Difficulty · higher is harder
            </p>
            <p className={styles.number} aria-hidden="true">
              <b className={`${styles.mono} ${styles.display}`}>
                <CountUp target={combined.score} />
              </b>
              <small className={`${styles.mono} ${styles.title2}`}>/ 10</small>
            </p>
            <span className={`${styles.verdict} ${styles.body2}`}>
              <i
                className={styles.dot}
                style={{ background: VERDICT_COLOURS[combined.verdict] }}
                aria-hidden="true"
              />
              {VERDICT_LABELS[combined.verdict]}
            </span>
          </>
        ) : (
          <p className={`${styles.waiting} ${styles.body2}`}>
            No difficulty score yet. It appears once the subject and a professor each have
            enough votes.
          </p>
        )}
      </section>

      {/* Without the averages of all courses there are no ranks, so the tiles are left out
          rather than showing a wrong reason. */}
      {ranks.available && (
      <ul className={styles.tiles} aria-label="Ranks">
        {rankTile(
          professor ? ranks.score[professor.id] : undefined,
          "Difficulty rank · #1 is the hardest",
          professor ? undefined : NO_PROFESSOR_NOTE,
        )}
        <Tile
          value={ranks.easierThan}
          caption="Of rated courses have a lighter load"
          note={sheet.subject.averages ? "No other rated courses yet" : MIN_VOTES_NOTE}
        />
        {rankTile(
          professor ? ranks.professor[professor.id] : undefined,
          "Professor teaching rank",
          professor ? undefined : NO_PROFESSOR_NOTE,
        )}
      </ul>
      )}

      <section className={styles.block} aria-labelledby="subject-title">
        <div className={styles.blockHead}>
          <h2 className={`${styles.mono} ${styles.caption} ${styles.label}`} id="subject-title">
            The subject
          </h2>
          {sheet.subject.load !== null && (
            <b className={`${styles.mono} ${styles.title1}`}>
              <small className={styles.caption}>Load</small>
              {one(sheet.subject.load)}
            </b>
          )}
        </div>
        <Averages criteria={SUBJECT_CRITERIA} averages={sheet.subject.averages} votes={sheet.subject.votes} />
      </section>

      {professor && (
        <div className={styles.pickRow}>
          {sheet.professors.length > 1 ? (
            <Switcher professors={sheet.professors} selected={professor.id} onSelect={setProfessorId} />
          ) : (
            <p className={`${styles.single} ${styles.body2}`}>
              <span className={styles.caption}>Taught by</span> {professor.name}
            </p>
          )}
        </div>
      )}

      <section className={styles.block} aria-labelledby="professor-title">
        <div className={styles.blockHead}>
          <h2 className={`${styles.mono} ${styles.caption} ${styles.label}`} id="professor-title">
            The professor{professor ? ` · ${professor.name}` : ""}
          </h2>
          {professor && professor.teach !== null && (
            <b className={`${styles.mono} ${styles.title1}`}>
              <small className={styles.caption}>Teaching</small>
              {one(professor.teach)}
            </b>
          )}
        </div>
        {professor ? (
          <Averages criteria={PROFESSOR_CRITERIA} averages={professor.averages} votes={professor.votes} />
        ) : (
          <p className={`${styles.waiting} ${styles.body2}`}>No professor is listed for this course yet.</p>
        )}
      </section>

      {plan && (
        <section className={styles.block} aria-labelledby="plan-title">
          <div className={styles.blockHead}>
            <h2 className={`${styles.mono} ${styles.caption} ${styles.label}`} id="plan-title">
              How to study this
            </h2>
          </div>
          <p className={`${styles.planLine} ${styles.title2}`}>{plan.line}</p>
          <div ref={tipsRef} data-seen={tipsSeen ? "" : undefined}>
            <ol className={styles.tips}>
              {plan.tips.map((tip, i) => (
                <li
                  key={tip}
                  className={`${styles.tip} ${styles.target}`}
                  style={{ "--delay": `${Math.min(i * 60, 400)}ms` } as CSSProperties}
                  data-beam-target
                >
                  <span className={`${styles.tipNumber} ${styles.mono} ${styles.body2}`}>
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className={styles.body1}>{tip}</span>
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}

      <Resources code={course.code} resources={resources} booklets={booklets} />

      <section className={styles.block} aria-labelledby="rating-title">
        <div className={styles.blockHead}>
          <h2 className={`${styles.mono} ${styles.caption} ${styles.label}`} id="rating-title">
            Your rating
          </h2>
          <span className={`${styles.legend} ${styles.caption}`}>
            0 to 10 in steps of 0.5 · posting opens soon, nothing is saved yet
          </span>
        </div>
        <div className={styles.strip} data-complete={complete ? "" : undefined}>
          <span className={`${styles.stripText} ${styles.body2}`}>
            {rated} of {total} rated
          </span>
          <span className={styles.segments} aria-hidden="true">
            {Array.from({ length: total }, (_, i) => (
              <span key={i} className={styles.segment} data-on={i < rated ? "" : undefined} />
            ))}
          </span>
        </div>
        {/* Nothing is saved yet. Posting goes through submit_rating() (Pack 5). Until then the Post
            button stays disabled; the onSubmit and the fireworks are kept so Pack 5 only has to
            enable posting. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!complete) return;
            setBurst((current) => current + 1);
            setSubmittedFor(professor?.id ?? "");
          }}
          noValidate
        >
          <h3 className={`${styles.group} ${styles.body2}`}>The subject</h3>
          <div className={styles.dials}>
            {SUBJECT_CRITERIA.map((criterion) => (
              <div key={criterion.key} className={styles.dialCell}>
                <BeamDial
                  id={`rate-${criterion.key}`}
                  label={criterion.label}
                  hint={criterion.hint}
                  value={rating[criterion.key] ?? null}
                  onChange={set(criterion.key)}
                  scale={criterion.key === "interest" ? "quality" : "hardness"}
                />
              </div>
            ))}
          </div>
          {professor && (
            <>
              <h3 className={`${styles.group} ${styles.body2}`}>{professor.name}</h3>
              <div className={styles.dials}>
                {PROFESSOR_CRITERIA.map((criterion) => (
                  <div key={professorKey(criterion)} className={styles.dialCell}>
                    <BeamDial
                      id={`rate-${professor.id}-${criterion.key}`}
                      label={criterion.label}
                      hint={criterion.hint}
                      value={rating[professorKey(criterion)] ?? null}
                      onChange={set(professorKey(criterion))}
                    />
                  </div>
                ))}
              </div>
            </>
          )}
          <div className={styles.formFoot}>
            <p role="status" className={`${styles.status} ${styles.body2}`}>
              {!complete
                ? `${left} left to rate.`
                : submitted
                  ? "Your rating is ready. Posting opens soon, so it is not saved yet."
                  : "Posting ratings is not open yet."}
            </p>
            <button type="submit" className={`${styles.post} ${styles.body2}`} disabled>
              Post rating
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

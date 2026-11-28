"use client";

// The card of one course: the combined score (the course's overall difficulty), the
// subject block, the professor block with
// its selector, and the six rating sliders.
//
// Between the professor block and the sliders sits "Resources" (Resources.tsx): the study
// material and the two booklets of the course.
//
// This is a basic outline. Still to do (Pack 4 and Pack 5): the final look of the card,
// ranks and study tips, and posting the rating through submit_rating().
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { programmeName } from "@/lib/auth/programmes";
import type { CourseDetails } from "@/lib/course-sheet-data";
import { PROFESSOR_CRITERIA, SUBJECT_CRITERIA, type CourseSheet } from "@/lib/course-sheet";
import type { CourseResources } from "@/lib/resources";
import { VERDICT_LABELS } from "@/lib/score";
import styles from "./CourseCard.module.css";
import { Resources, type BookletSummary } from "./Resources";

const MIN_VOTES_NOTE = "Not enough votes yet";

function one(value: number): string {
  return value.toFixed(1);
}

function quartersText(quarters: number[]): string {
  if (quarters.length === 0) return "";
  const first = Math.min(...quarters);
  const last = Math.max(...quarters);
  return first === last ? `Q${first}` : `Q${first}–Q${last}`;
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
  if (!averages) {
    return (
      <p className={styles.waiting}>
        {MIN_VOTES_NOTE} · {votes} {votes === 1 ? "vote" : "votes"} so far
      </p>
    );
  }
  return (
    <dl className={styles.bars}>
      {criteria.map((criterion) => (
        <div key={criterion.key} className={styles.bar}>
          <dt>{criterion.label}</dt>
          <dd>
            <span className={styles.track} aria-hidden="true">
              <span style={{ width: `${averages[criterion.key] * 10}%` }} />
            </span>
            <b>{one(averages[criterion.key])}</b>
          </dd>
        </div>
      ))}
    </dl>
  );
}

// One slider from 0 to 10 in half points. It counts as set once the student has touched it.
function Slider({
  id,
  criterion,
  value,
  onChange,
}: {
  id: string;
  criterion: Criterion;
  value: number | null;
  onChange: (value: number) => void;
}) {
  const shown = value ?? 5;
  return (
    <div className={styles.slider} data-set={value === null ? undefined : ""}>
      <div className={styles.sliderHead}>
        <label htmlFor={id}>
          {criterion.label}
          <small>{criterion.hint}</small>
        </label>
        <output htmlFor={id}>{value === null ? "–" : one(value)}</output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={10}
        step={0.5}
        value={shown}
        aria-valuetext={value === null ? "Not rated yet" : `${one(value)} out of 10`}
        style={{ "--p": `${shown * 10}%` } as CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
        // A click or a key press on the starting position is a rating of 5 as well. A click and
        // not a pointer down: a finger that starts scrolling the page on a slider is a pointer
        // down too, and must not count as a rating.
        onClick={(event) => value === null && onChange(Number(event.currentTarget.value))}
        onKeyDown={(event) => value === null && event.key.startsWith("Arrow") && onChange(shown)}
      />
    </div>
  );
}

export function CourseCard({
  course,
  sheet,
  resources,
  booklets,
}: {
  course: CourseDetails;
  sheet: CourseSheet;
  resources: CourseResources | null;
  booklets: BookletSummary;
}) {
  const [professorId, setProfessorId] = useState(sheet.startProfessorId);
  const [rating, setRating] = useState<Record<string, number>>({});

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
  const set = (key: string) => (value: number) => setRating((current) => ({ ...current, [key]: value }));

  return (
    <main className={styles.card}>
      <Link href={`/?programme=${course.programme}&year=${course.year}`} className={styles.back}>
        ← Calendar
      </Link>

      <header className={styles.head}>
        <span className="mono">
          {course.code} · {programmeName(course.programme)} · Year {course.year}
          {course.quarters.length > 0 && ` · ${quartersText(course.quarters)}`}
        </span>
        <h1 className={styles.title}>{course.name}</h1>
      </header>

      <section className={styles.score} aria-label="Overall difficulty">
        {combined ? (
          <>
            {/* Higher is harder, which a bare "5.4 / 10" would not say. */}
            <span className={`mono ${styles.scoreLabel}`}>Difficulty · 1 easiest, 10 hardest</span>
            <b>
              {one(combined.score)}
              <small>/ 10</small>
            </b>
            <span className={styles.verdict}>{VERDICT_LABELS[combined.verdict]}</span>
          </>
        ) : (
          <p className={styles.waiting}>
            No difficulty score yet. It appears once the subject and a professor each have
            enough votes.
          </p>
        )}
      </section>

      <section className={styles.block} aria-labelledby="subject-title">
        <div className={styles.blockHead}>
          <h2 className="mono" id="subject-title">
            The subject
          </h2>
          {sheet.subject.load !== null && (
            <b>
              <small>Load</small>
              {one(sheet.subject.load)}
            </b>
          )}
        </div>
        <Averages criteria={SUBJECT_CRITERIA} averages={sheet.subject.averages} votes={sheet.subject.votes} />
      </section>

      <section className={styles.block} aria-labelledby="professor-title">
        <div className={styles.blockHead}>
          <h2 className="mono" id="professor-title">
            The professor
          </h2>
          {professor && professor.teach !== null && (
            <b>
              <small>Teaching</small>
              {one(professor.teach)}
            </b>
          )}
        </div>
        {professor ? (
          <>
            <div className={styles.pills} role="group" aria-label="Professor">
              {sheet.professors.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={styles.pill}
                  aria-pressed={p.id === professor.id}
                  onClick={() => setProfessorId(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
            <Averages criteria={PROFESSOR_CRITERIA} averages={professor.averages} votes={professor.votes} />
          </>
        ) : (
          <p className={styles.waiting}>No professor is listed for this course yet.</p>
        )}
      </section>

      <Resources code={course.code} resources={resources} booklets={booklets} />

      <section className={styles.block} aria-labelledby="rating-title">
        <div className={styles.blockHead}>
          <h2 className="mono" id="rating-title">
            Your rating
          </h2>
          <span className={styles.legend}>0 to 10, half-point steps</span>
        </div>
        {/* Outline only: nothing is saved yet. Posting goes through submit_rating() (Pack 5). */}
        <form onSubmit={(event) => event.preventDefault()} noValidate>
          <h3 className={styles.group}>The subject</h3>
          {SUBJECT_CRITERIA.map((criterion) => (
            <Slider
              key={criterion.key}
              id={`rate-${criterion.key}`}
              criterion={criterion}
              value={rating[criterion.key] ?? null}
              onChange={set(criterion.key)}
            />
          ))}
          {professor && (
            <>
              <h3 className={styles.group}>{professor.name}</h3>
              {PROFESSOR_CRITERIA.map((criterion) => (
                <Slider
                  key={professorKey(criterion)}
                  id={`rate-${criterion.key}`}
                  criterion={criterion}
                  value={rating[professorKey(criterion)] ?? null}
                  onChange={set(professorKey(criterion))}
                />
              ))}
            </>
          )}
          <div className={styles.formFoot}>
            <p role="status">
              {left > 0
                ? `${left} ${left === 1 ? "slider" : "sliders"} left.`
                : "Posting ratings is not open yet."}
            </p>
            <button type="submit" className={styles.post} disabled>
              Post rating
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}

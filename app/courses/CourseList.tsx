"use client";

// The list of all courses: search, programme chips, sorting and the grid of cards.
import Link from "next/link";
import { useState, type CSSProperties } from "react";
import { programmeName } from "@/lib/auth/programmes";
import {
  filterCourses,
  programmeCounts,
  sortCourses,
  type CourseListEntry,
  type CourseSort,
  type ProgrammeFilter,
} from "@/lib/course-list";
import { VERDICT_LABELS } from "@/lib/score";
import {
  cardLabel,
  countText,
  oneDecimal,
  ringDash,
  RING_RADIUS,
  scoreNote,
  VERDICT_COLOURS,
  votesText,
} from "./course-card-text";
import styles from "./CourseList.module.css";

const SORTS: { id: CourseSort; label: string }[] = [
  { id: "hardest", label: "Hardest" },
  { id: "easiest", label: "Easiest" },
  { id: "most", label: "Most rated" },
  { id: "az", label: "A–Z" },
];

export function CourseList({ entries }: { entries: CourseListEntry[] }) {
  const [query, setQuery] = useState("");
  const [programme, setProgramme] = useState<ProgrammeFilter>("ALL");
  const [sort, setSort] = useState<CourseSort>("hardest");

  const chips = programmeCounts(entries, query);
  const shown = sortCourses(filterCourses(entries, { programme, query }), sort);
  const trimmed = query.trim();

  return (
    <section aria-label="All courses">
      <div className={styles.controls}>
        <div className={styles.search}>
          <label htmlFor="course-search" className={styles.sr}>
            Search courses
          </label>
          <input
            id="course-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search a course, professor or programme"
            autoComplete="off"
          />
        </div>
        <div className={styles.chips} role="group" aria-label="Filter by programme">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={styles.chip}
              aria-pressed={programme === chip.id}
              onClick={() => setProgramme(chip.id)}
            >
              {chip.label}
              <small>{chip.count}</small>
            </button>
          ))}
        </div>
        <div className={styles.sort} role="group" aria-label="Sort courses">
          {SORTS.map((option) => (
            <button
              key={option.id}
              type="button"
              aria-pressed={sort === option.id}
              onClick={() => setSort(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.facname}>
        <span className="mono">
          {programme === "ALL" ? "All programmes" : programmeName(programme)}
          {trimmed ? ` · “${trimmed}”` : ""}
        </span>
        <span className="mono" aria-live="polite">
          {countText(shown.length)}
        </span>
      </div>
      <div className={styles.grid}>
        {shown.length === 0 ? (
          <div className={styles.empty}>
            No course matches that yet.
            <br />
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setProgramme("ALL");
              }}
            >
              Clear search and filters
            </button>
          </div>
        ) : (
          shown.map((entry) => <Card key={entry.code} entry={entry} />)
        )}
      </div>
    </section>
  );
}

function Card({ entry }: { entry: CourseListEntry }) {
  const { verdict, score } = entry;
  return (
    <Link
      href={`/courses/${encodeURIComponent(entry.code)}`}
      className={styles.card}
      aria-label={cardLabel(entry)}
    >
      <span className={styles.top}>
        {verdict ? (
          <span className={styles.verdict} style={{ "--c": VERDICT_COLOURS[verdict] } as CSSProperties}>
            <i />
            {VERDICT_LABELS[verdict]}
          </span>
        ) : (
          <span />
        )}
        <span className={styles.tag}>
          {entry.programme} · Y{entry.year}
        </span>
      </span>
      <span className={styles.name}>{entry.name}</span>
      <span className={styles.prof}>
        {entry.code} · {entry.professor?.name ?? "No professor listed"}
      </span>
      <span className={styles.bottom}>
        <span className={styles.score}>
          <svg className={styles.ring} viewBox="0 0 58 58" aria-hidden="true">
            <circle className={styles.track} cx="29" cy="29" r={RING_RADIUS} />
            <circle className={styles.value} cx="29" cy="29" r={RING_RADIUS} strokeDasharray={ringDash(score)} />
          </svg>
          <span>
            {score === null ? (
              <b className={styles.none}>{scoreNote(entry)}</b>
            ) : (
              <b>{oneDecimal(score)}</b>
            )}
            <span>{votesText(entry.votes)}</span>
          </span>
        </span>
        <span className={styles.meta}>
          <b>{oneDecimal(entry.sheet.subject.load)}</b> subject load
          <br />
          <b>{oneDecimal(entry.professor?.teach)}</b> professor
        </span>
      </span>
    </Link>
  );
}

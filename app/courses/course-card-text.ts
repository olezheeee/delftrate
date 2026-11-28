// The small pieces of text and maths on a course card, kept apart so they are tested.
import type { CourseListEntry } from "@/lib/course-list";
import { VERDICT_LABELS, type Verdict } from "@/lib/score";

export const RING_RADIUS = 26;
export const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

export const VERDICT_COLOURS: Record<Verdict, string> = {
  "hard-well-taught": "#7fd0f7",
  "brace-yourself": "#ff9d8a",
  "smooth-ride": "#8fe0b0",
  "manageable-solo": "#f2b46a",
};

// One decimal, or a dash for a missing number.
export function oneDecimal(value: number | null | undefined): string {
  return value === null || value === undefined ? "–" : value.toFixed(1);
}

export function votesText(votes: number): string {
  return `${votes} ${votes === 1 ? "vote" : "votes"}`;
}

// The filled part of the ring: score/10 of the circle, kept between empty and full.
export function ringDash(score: number | null): string {
  const share = score === null ? 0 : Math.min(Math.max(score / 10, 0), 1);
  return `${(share * RING_LENGTH).toFixed(1)} ${RING_LENGTH.toFixed(1)}`;
}

// What the card shows in place of the score. The combined score needs a professor, so a
// course without a visible one cannot get a score however many votes its subject has.
export function scoreNote(entry: CourseListEntry): string {
  return entry.professor === null ? "No score without a professor" : "Not enough votes yet";
}

// The name a screen reader gives the card. It replaces what the card shows, so it carries
// the same facts: the verdict and the number of votes as well as the score.
export function cardLabel(entry: CourseListEntry): string {
  const professor = entry.professor?.name ?? "no professor listed";
  const rating =
    entry.score === null
      ? scoreNote(entry).toLowerCase()
      : `difficulty ${entry.score.toFixed(1)} out of 10` +
        (entry.verdict ? `, ${VERDICT_LABELS[entry.verdict].toLowerCase()}` : "");
  return `${entry.name}, ${entry.programme} year ${entry.year}, ${professor}, ${rating}, ${votesText(entry.votes)}`;
}

export function countText(count: number): string {
  return `${count} ${count === 1 ? "course" : "courses"}`;
}

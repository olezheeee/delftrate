import { describe, expect, it } from "vitest";
import type { CourseListEntry } from "@/lib/course-list";
import type { Verdict } from "@/lib/score";
import { cardLabel, countText, oneDecimal, RING_LENGTH, ringDash, scoreNote, votesText } from "./course-card-text";

const entry = (score: number | null, professor: string | null, verdict: Verdict | null = null) =>
  ({
    name: "Calculus",
    programme: "CSE",
    year: 1,
    votes: 42,
    score,
    verdict,
    professor: professor ? { name: professor } : null,
  }) as unknown as CourseListEntry;

describe("course card text", () => {
  it("formats numbers", () => {
    expect(oneDecimal(6.04)).toBe("6.0");
    expect(oneDecimal(null)).toBe("–");
    expect(votesText(1)).toBe("1 vote");
    expect(votesText(0)).toBe("0 votes");
    expect(countText(1)).toBe("1 course");
    expect(countText(3)).toBe("3 courses");
  });
  it("draws the ring", () => {
    expect(ringDash(null)).toBe(`0.0 ${RING_LENGTH.toFixed(1)}`);
    expect(ringDash(10)).toBe(`${RING_LENGTH.toFixed(1)} ${RING_LENGTH.toFixed(1)}`);
    expect(ringDash(5)).toBe(`${(RING_LENGTH / 2).toFixed(1)} ${RING_LENGTH.toFixed(1)}`);
    expect(ringDash(14)).toBe(ringDash(10));
  });
  it("reads the label naturally, with what the card shows", () => {
    expect(cardLabel(entry(7.25, "Dr. Jansen", "brace-yourself"))).toBe(
      "Calculus, CSE year 1, Dr. Jansen, difficulty 7.3 out of 10, brace yourself, 42 votes",
    );
    expect(cardLabel(entry(null, "Dr. Jansen"))).toBe("Calculus, CSE year 1, Dr. Jansen, not enough votes yet, 42 votes");
    expect(cardLabel(entry(null, null))).toBe(
      "Calculus, CSE year 1, no professor listed, no score without a professor, 42 votes",
    );
  });
  it("tells a course without a professor apart from one with too few votes", () => {
    expect(scoreNote(entry(null, "Dr. Jansen"))).toBe("Not enough votes yet");
    expect(scoreNote(entry(null, null))).toBe("No score without a professor");
  });
});

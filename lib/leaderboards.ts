// The leaderboards: six boards built from the course list. No React and no database here.
// A course or professor is on a board only when the value the board ranks by is not null;
// null means the database found too few votes, and the votes are never counted again here.
import type { CourseListEntry } from "./course-list";
import { tidy } from "./score";

export type BoardRow = {
  rank: number;
  title: string;
  subtitle: string;
  value: number;
  href: string;
};

export type Board = {
  id: string;
  title: string;
  description: string;
  size: 3 | 5;
  big: boolean;
  colour?: string;
  rows: BoardRow[];
};

type Candidate = Omit<BoardRow, "rank">;

const courseHref = (code: string) => `/courses/${encodeURIComponent(code)}`;

function rank(candidates: Candidate[], size: number): BoardRow[] {
  const text = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...candidates]
    // Values are compared tidied, so floating point noise does not decide between two rows
    // that show the same number.
    .sort((a, b) => tidy(b.value) - tidy(a.value) || text(a.title, b.title) || text(a.href, b.href))
    .slice(0, size)
    .map((row, index) => ({ rank: index + 1, ...row }));
}

function perCourse(
  entries: readonly CourseListEntry[],
  value: (entry: CourseListEntry) => number | null | undefined,
  subtitle: (entry: CourseListEntry) => string,
): Candidate[] {
  return entries.flatMap((entry) => {
    const v = value(entry);
    if (v === null || v === undefined) return [];
    return [{ title: entry.name, subtitle: subtitle(entry), value: v, href: courseHref(entry.code) }];
  });
}

function perProfessor(
  entries: readonly CourseListEntry[],
  value: (professor: CourseListEntry["sheet"]["professors"][number]) => number | null | undefined,
  subtitle: (entry: CourseListEntry) => string,
): Candidate[] {
  return entries.flatMap((entry) =>
    entry.sheet.professors.flatMap((professor) => {
      const v = value(professor);
      if (v === null || v === undefined) return [];
      return [{ title: professor.name, subtitle: subtitle(entry), value: v, href: courseHref(entry.code) }];
    }),
  );
}

function hardestYears(entries: readonly CourseListEntry[]): Candidate[] {
  const groups = new Map<string, { entry: CourseListEntry; loads: number[] }>();
  for (const entry of entries) {
    const load = entry.sheet.subject.load;
    if (load === null) continue;
    const key = `${entry.programme}\u0000${entry.year}`;
    const group = groups.get(key);
    if (group) group.loads.push(load);
    else groups.set(key, { entry, loads: [load] });
  }
  return [...groups.values()].map(({ entry, loads }) => ({
    title: `${entry.programmeName}, year ${entry.year}`,
    subtitle: `${entry.programme} · ${loads.length} ${loads.length === 1 ? "course" : "courses"} rated`,
    value: loads.reduce((sum, load) => sum + load, 0) / loads.length,
    href: `/?programme=${encodeURIComponent(entry.programme)}&year=${entry.year}`,
  }));
}

export function buildBoards(entries: readonly CourseListEntry[]): Board[] {
  const programmeYear = (e: CourseListEntry) => `${e.programme} · Y${e.year}`;
  const programmeCourse = (e: CourseListEntry) => `${e.programme} · ${e.name}`;
  const courseName = (e: CourseListEntry) => e.name;
  const programme = (e: CourseListEntry) => e.programme;

  const make = (
    id: string,
    title: string,
    description: string,
    candidates: Candidate[],
    colour?: string,
  ): Board => {
    const big = colour !== undefined;
    const size = big ? 5 : 3;
    return { id, title, description, size, big, ...(colour ? { colour } : {}), rows: rank(candidates, size) };
  };

  return [
    make("hardest-subjects", "Hardest subjects", "Difficulty and exam level, combined",
      perCourse(entries, (e) => e.sheet.subject.load, programmeYear), "#ff9d8a"),
    make("best-professors", "Best professors", "Engagement, understanding and approachability",
      perProfessor(entries, (p) => p.teach, programmeCourse), "#7fd0f7"),
    make("toughest-exams", "Toughest exams", "Exam level",
      perCourse(entries, (e) => e.sheet.subject.averages?.exam_level, programme)),
    make("most-interesting", "Most interesting", "Interest in the subject",
      perCourse(entries, (e) => e.sheet.subject.averages?.interest, programme)),
    make("most-approachable", "Most approachable", "Professors you can actually ask",
      perProfessor(entries, (p) => p.averages?.approachability, courseName)),
    make("hardest-years", "Hardest years", "Average subject load per year", hardestYears(entries)),
  ];
}

export function shareText(board: Board): string {
  if (board.rows.length === 0) {
    return `${board.title} at TU Delft, according to DelftRate: not enough votes yet.`;
  }
  const list = board.rows.map((row) => `${row.rank}. ${row.title} (${row.value.toFixed(1)})`).join(", ");
  return `${board.title} at TU Delft, according to DelftRate: ${list}. Agree?`;
}

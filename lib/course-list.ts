// What the course list shows: one entry per course with everything a card, the search, the
// programme chips and the sort need. Built from the rows of the database through
// buildCourseSheet, so the minimum of votes and the hidden professors are handled in one
// place. No React and no database here, so it is tested on its own.
import { PROGRAMMES, programmeName } from "./auth/programmes";
import { buildCourseSheet, type CourseSheet, type SheetProfessor } from "./course-sheet";
import { tidy, type ProfessorStatsRow, type SubjectStatsRow, type Verdict } from "./score";

export type CourseListEntry = {
  code: string;
  name: string;
  programme: string;
  programmeName: string;
  year: number;
  quarters: number[];
  sheet: CourseSheet;
  // The start professor of the sheet, or null for a course without professors.
  professor: SheetProfessor | null;
  // The overall difficulty of the course with that professor. Null when the professor or
  // the subject has too few votes.
  score: number | null;
  verdict: Verdict | null;
  // The votes on the subject, for sorting on the most rated.
  votes: number;
};

export type CourseRow = {
  id: string;
  code: string;
  name: string;
  programme_id: string;
  year: number;
  quarters: number[];
};

export type ProfessorLinkRow = {
  course_id: string;
  professors: { id: string; name: string; hidden: boolean } | null;
};

function groupBy<T>(rows: readonly T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const group = groups.get(key(row));
    if (group) group.push(row);
    else groups.set(key(row), [row]);
  }
  return groups;
}

// Ordered by code. The rows of all courses come in one go, so they are grouped by course
// first instead of searched again for every course.
export function buildCourseList(
  courses: readonly CourseRow[],
  links: readonly ProfessorLinkRow[],
  subjectRows: readonly SubjectStatsRow[],
  professorRows: readonly ProfessorStatsRow[],
): CourseListEntry[] {
  const linksByCourse = groupBy(links, (link) => link.course_id);
  const subjectByCourse = new Map(subjectRows.map((row) => [row.course_id, row]));
  const professorsByCourse = groupBy(professorRows, (row) => row.course_id);

  return [...courses]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((course): CourseListEntry => {
      const professors = (linksByCourse.get(course.id) ?? []).flatMap((link) =>
        link.professors ? [link.professors] : [],
      );
      const sheet = buildCourseSheet(
        professors,
        subjectByCourse.get(course.id) ?? null,
        professorsByCourse.get(course.id) ?? [],
      );
      const professor = sheet.professors.find((p) => p.id === sheet.startProfessorId) ?? null;
      return {
        code: course.code,
        name: course.name,
        programme: course.programme_id,
        programmeName: programmeName(course.programme_id),
        year: course.year,
        quarters: course.quarters,
        sheet,
        professor,
        score: professor?.combined?.score ?? null,
        verdict: professor?.combined?.verdict ?? null,
        votes: sheet.subject.votes,
      };
    });
}

export type ProgrammeFilter = "ALL" | string;
export type CourseSort = "hardest" | "easiest" | "most" | "az";

// Lower case without accents, so "muller" finds "Müller".
function fold(text: string): string {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

// Every word of the query must be found in the code, the name, the programme or the name of
// a professor the students can see.
export function matchesQuery(entry: CourseListEntry, query: string): boolean {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const haystack = [
    entry.code,
    entry.name,
    entry.programme,
    entry.programmeName,
    ...entry.sheet.professors.map((professor) => professor.name),
  ].map(fold);
  return words.every((word) => haystack.some((text) => text.includes(word)));
}

export function filterCourses(
  entries: readonly CourseListEntry[],
  filter: { programme: ProgrammeFilter; query: string },
): CourseListEntry[] {
  return entries.filter(
    (entry) => (filter.programme === "ALL" || entry.programme === filter.programme) && matchesQuery(entry, filter.query),
  );
}

// Returns a new array. Every order ends on the code, so it never depends on the input order.
export function sortCourses(entries: readonly CourseListEntry[], sort: CourseSort): CourseListEntry[] {
  const byCode = (a: CourseListEntry, b: CourseListEntry) => a.code.localeCompare(b.code);
  // Courses without a score go after the scored ones, whichever way the scores run.
  const byScore = (direction: 1 | -1) => (a: CourseListEntry, b: CourseListEntry) => {
    if (a.score === null || b.score === null) {
      if (a.score === b.score) return byCode(a, b);
      return a.score === null ? 1 : -1;
    }
    // Compared tidied, so two scores that both show as 7.8 tie and fall back to the code.
    return direction * (tidy(a.score) - tidy(b.score)) || byCode(a, b);
  };
  const compare = {
    hardest: byScore(-1),
    easiest: byScore(1),
    most: (a: CourseListEntry, b: CourseListEntry) => b.votes - a.votes || byCode(a, b),
    az: (a: CourseListEntry, b: CourseListEntry) => a.name.localeCompare(b.name) || byCode(a, b),
  }[sort];
  return [...entries].sort(compare);
}

// For the filter chips: how many courses each chip would show with the current search.
export function programmeCounts(
  entries: readonly CourseListEntry[],
  query: string,
): { id: ProgrammeFilter; label: string; count: number }[] {
  const matching = entries.filter((entry) => matchesQuery(entry, query));
  return [
    { id: "ALL", label: "All", count: matching.length },
    ...PROGRAMMES.map((programme) => ({
      id: programme.id as ProgrammeFilter,
      label: programme.id as string,
      count: matching.filter((entry) => entry.programme === programme.id).length,
    })),
  ];
}

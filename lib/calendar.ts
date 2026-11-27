// The course calendar of the home page: which programme and year is shown, and where each
// course sits in the grid of four quarters. No React and no database here, so it is tested
// on its own (calendar.test.ts).
import { PROGRAMMES, YEARS, type ProgrammeId } from "./auth/programmes";

export type CalendarCourse = {
  code: string;
  name: string;
  programme: string;
  year: number;
  quarters: number[];
};

// The ratings of a course as its three circles in the calendar show them, each out of 10:
// the combined score, the subject's load, and the teaching score of the course's default
// professor. Each is null until its block has enough votes; the score needs both blocks.
// They come from the database function calendar_scores().
export type CourseNumbers = { score: number | null; load: number | null; teach: number | null };

// What the visitor picked. The year only counts once a programme is picked.
export type Choice = { programme: ProgrammeId | null; year: number | null };

// Reads a choice from the address (/?programme=CSE&year=2) or from a profile. Anything the
// calendar does not offer is dropped.
export function parseChoice(input: { programme?: unknown; year?: unknown }): Choice {
  const programme = PROGRAMMES.find((p) => p.id === input.programme)?.id ?? null;
  const year = YEARS.find((y) => String(y) === String(input.year)) ?? null;
  return { programme, year: programme ? year : null };
}

// A place in a grid. Rows and columns count from 0; a block covers `span` columns and
// `height` rows.
export type Placed<T> = { item: T; row: number; column: number; span: number; height: number };

// Courses of one module are drawn together, as on the Aerospace curriculum sheet: AE1110-I
// and AE1110-II belong to AE1110. A course on its own is a block of one.
export type CalendarBlock = {
  // The module code, or the course's own code for a course that stands alone.
  code: string;
  isModule: boolean;
  firstQuarter: number;
  lastQuarter: number;
  // The courses inside, placed in a grid that starts at this block's first quarter.
  courses: Placed<CalendarCourse>[];
};

export type CalendarLayout = { rows: number; blocks: Placed<CalendarBlock>[] };

type Span = { first: number; last: number };

// The quarters of a course as one unbroken stretch. A course listed for quarters 1 and 3
// is drawn from 1 to 3: the grid has no way to show a gap inside one rectangle.
function stretch(quarters: number[]): Span {
  return { first: Math.min(...quarters), last: Math.max(...quarters) };
}

// "AE1110-II" belongs to module "AE1110". Only a Roman numeral after the last hyphen counts.
export function moduleCode(courseCode: string): string {
  return courseCode.replace(/-[IVX]+$/, "");
}

// Puts each item in the first row where its columns are still free, in the order given.
// Then lets every item grow downwards into rows nothing else uses, so a course without
// neighbours fills its quarter instead of leaving a hole.
function pack<T>(items: { item: T; span: Span }[], firstColumn: number): { rows: number; placed: Placed<T>[] } {
  const taken: boolean[][] = [];
  const isFree = (row: number, from: number, to: number) => {
    for (let column = from; column <= to; column++) if (taken[row]?.[column]) return false;
    return true;
  };
  const take = (row: number, from: number, to: number) => {
    taken[row] ??= [];
    for (let column = from; column <= to; column++) taken[row][column] = true;
  };

  const placed = items.map(({ item, span }) => {
    const from = span.first - firstColumn;
    const to = span.last - firstColumn;
    let row = 0;
    while (!isFree(row, from, to)) row++;
    take(row, from, to);
    return { item, row, column: from, span: to - from + 1, height: 1 };
  });
  for (const block of placed) {
    const to = block.column + block.span - 1;
    while (block.row + block.height < taken.length && isFree(block.row + block.height, block.column, to)) {
      take(block.row + block.height, block.column, to);
      block.height++;
    }
  }
  return { rows: taken.length, placed };
}

function byQuarterThenCode<T extends { code: string }>(a: T & Span, b: T & Span): number {
  // Earlier quarters first; among those the longer course first, so it gets the top row.
  return a.first - b.first || b.last - a.last || a.code.localeCompare(b.code);
}

// Lays out the courses of one programme and year. Courses without quarters are left out:
// there is nowhere to draw them.
export function layoutCalendar(courses: CalendarCourse[]): CalendarLayout {
  const groups = new Map<string, CalendarCourse[]>();
  for (const course of courses) {
    if (course.quarters.length === 0) continue;
    const code = moduleCode(course.code);
    groups.set(code, [...(groups.get(code) ?? []), course]);
  }

  const blocks = [...groups.entries()]
    .flatMap(([code, members]) =>
      // A module needs at least two courses; one course alone keeps its own code.
      members.length > 1 ? [{ code, members }] : members.map((course) => ({ code: course.code, members: [course] })),
    )
    .map(({ code, members }) => {
      const spans = members.map((course) => ({ course, code: course.code, ...stretch(course.quarters) }));
      const first = Math.min(...spans.map((s) => s.first));
      const last = Math.max(...spans.map((s) => s.last));
      const inside = pack(
        spans.sort(byQuarterThenCode).map((s) => ({ item: s.course, span: { first: s.first, last: s.last } })),
        first,
      );
      const block: CalendarBlock = {
        code,
        isModule: members.length > 1,
        firstQuarter: first,
        lastQuarter: last,
        courses: inside.placed,
      };
      return { block, code, first, last };
    })
    .sort(byQuarterThenCode);

  // Quarter 1 is column 0.
  const { rows, placed } = pack(
    blocks.map((b) => ({ item: b.block, span: { first: b.first, last: b.last } })),
    1,
  );
  return { rows, blocks: placed };
}

// Where a click on a course leads. The course sheet needs an account, so a signed-out
// visitor goes to the login page first and lands on the course afterwards.
export function courseHref(code: string, signedIn: boolean): string {
  const path = `/courses/${encodeURIComponent(code)}`;
  return signedIn ? path : `/login?next=${encodeURIComponent(path)}`;
}

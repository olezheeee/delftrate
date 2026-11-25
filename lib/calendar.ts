// Pure layout logic for the course calendar. No React, no Supabase.

export type CalendarCourse = {
  code: string;
  name: string;
  programme: string;
  year: number;
  quarters: number[];
};

export type Quarter = 1 | 2 | 3 | 4;

export type Placement = {
  course: CalendarCourse;
  start: Quarter;
  span: number;
  lane: number;
};

export type CalendarLayout = {
  placements: Placement[];
  lanes: number;
  unplaced: number;
};

export const PROGRAMMES = ["AE", "CSE"] as const;
export type ProgrammeCode = (typeof PROGRAMMES)[number];
export const YEARS = [1, 2, 3] as const;
export type Year = (typeof YEARS)[number];

export type Choice = { programme: ProgrammeCode | null; year: Year | null };

type ParamValue = string | string[] | undefined | null;
type ParamsLike =
  | { get(name: string): string | null }
  | Record<string, ParamValue>;

function readParam(params: ParamsLike, name: string): string | undefined {
  if (typeof (params as { get?: unknown }).get === "function") {
    return (params as { get(n: string): string | null }).get(name) ?? undefined;
  }
  const v = (params as Record<string, ParamValue>)[name];
  const first = Array.isArray(v) ? v[0] : v;
  return first ?? undefined;
}

// Invalid or missing values become null ("nothing picked yet").
export function parseChoice(params: ParamsLike): Choice {
  const p = readParam(params, "programme");
  const y = readParam(params, "year");
  const programme = (PROGRAMMES as readonly string[]).includes(p ?? "")
    ? (p as ProgrammeCode)
    : null;
  const year = y === "1" || y === "2" || y === "3" ? (Number(y) as Year) : null;
  return { programme, year };
}

// Splits quarters into runs of adjacent quarters, e.g. [1,2,4] -> [[1,2],[4]].
function runs(quarters: number[]): number[][] {
  const sorted = [...new Set(quarters)]
    .filter((q) => Number.isInteger(q) && q >= 1 && q <= 4)
    .sort((a, b) => a - b);
  const out: number[][] = [];
  for (const q of sorted) {
    const last = out[out.length - 1];
    if (last && last[last.length - 1] === q - 1) last.push(q);
    else out.push([q]);
  }
  return out;
}

export function layoutCalendar(
  courses: CalendarCourse[],
  programme: string,
  year: number,
): CalendarLayout {
  // Runs are worked out once per course, not in every comparison of the sort.
  const selected = courses
    .filter((c) => c.programme === programme && c.year === year)
    .map((course) => ({ course, runs: runs(course.quarters) }));
  const firstQuarter = (r: number[][]) => (r.length ? r[0][0] : 99);
  selected.sort(
    (a, b) =>
      firstQuarter(a.runs) - firstQuarter(b.runs) ||
      (a.course.code < b.course.code ? -1 : a.course.code > b.course.code ? 1 : 0),
  );

  const placements: Placement[] = [];
  // Which quarters each lane already holds, so a gap in a lane (a course in Q1 and Q3
  // leaves Q2 free) can be used by a later course.
  const taken: boolean[][] = [];
  let unplaced = 0;

  for (const { course, runs: r } of selected) {
    if (r.length === 0) {
      unplaced += 1;
      continue;
    }
    for (const run of r) {
      const isFree = (lane: boolean[]) => run.every((q) => !lane[q]);
      let lane = taken.findIndex(isFree);
      if (lane === -1) {
        lane = taken.length;
        taken.push([]);
      }
      for (const q of run) taken[lane][q] = true;
      placements.push({
        course,
        start: run[0] as Quarter,
        span: run.length,
        lane,
      });
    }
  }
  return { placements, lanes: taken.length, unplaced };
}

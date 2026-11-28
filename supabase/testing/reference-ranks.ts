// The ranks of a course as the course page used to work them out itself, from the averages
// of every course. The database function course_ranks() does this now; this copy is kept
// for the tests only, as a second opinion that the function gives the same ranks.
import {
  courseScore,
  load,
  scoreWithProfessor,
  teach,
  type ProfessorAverages,
  type ProfessorStatsRow,
  type SubjectAverages,
  type SubjectStatsRow,
} from "../../lib/score";
import type { CourseRanks, Rank } from "../../lib/course-insights";

// Same idea as the private tidy() in score.ts: float noise must not decide a comparison.
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

function subjectAverages(row: SubjectStatsRow | undefined): SubjectAverages | null {
  if (!row?.enough_votes) return null;
  const { difficulty, exam_level, interest } = row;
  if (difficulty === null || exam_level === null || interest === null) return null;
  return { difficulty, exam_level, interest };
}

function professorAverages(row: ProfessorStatsRow): ProfessorAverages | null {
  if (row.hidden || !row.enough_votes) return null;
  const { engagement, understanding, approachability } = row;
  if (engagement === null || understanding === null || approachability === null) return null;
  return { engagement, understanding, approachability };
}

// 1 + the number of other values that are strictly higher. For the difficulty score the highest
// value is the hardest course, so #1 is the hardest; for the teaching score #1 is the best.
function rankOf(value: number, others: readonly number[]): Rank {
  const mine = tidy(value);
  return { rank: 1 + others.filter((other) => tidy(other) > mine).length, of: others.length + 1 };
}

export function referenceRanks(
  courseId: string,
  subjectRows: readonly SubjectStatsRow[],
  professorRows: readonly ProfessorStatsRow[],
): CourseRanks {
  const visibleRows = professorRows.filter((row) => !row.hidden);

  // Difficulty: the default-professor score of every other course. Rank 1 is the hardest.
  const professorsByCourse = new Map<string, ProfessorStatsRow[]>();
  for (const row of visibleRows) {
    const list = professorsByCourse.get(row.course_id);
    if (list) list.push(row);
    else professorsByCourse.set(row.course_id, [row]);
  }
  const otherScores: number[] = [];
  for (const subject of subjectRows) {
    if (subject.course_id === courseId) continue;
    const result = courseScore(subject, professorsByCourse.get(subject.course_id) ?? []);
    if (result) otherScores.push(result.score);
  }
  const ownSubject = subjectRows.find((row) => row.course_id === courseId);
  const score: Record<string, Rank> = {};
  if (ownSubject) {
    for (const row of professorsByCourse.get(courseId) ?? []) {
      const result = scoreWithProfessor(ownSubject, row);
      if (result) score[row.professor_id] = rankOf(result.score, otherScores);
    }
  }

  // Professor: teaching score among every visible professor row with enough votes.
  const teachings = visibleRows.flatMap((row) => {
    const averages = professorAverages(row);
    return averages ? [{ row, teach: teach(averages) }] : [];
  });
  const professor: Record<string, Rank> = {};
  for (const entry of teachings) {
    if (entry.row.course_id !== courseId) continue;
    const others = teachings.filter((other) => other !== entry).map((other) => other.teach);
    professor[entry.row.professor_id] = rankOf(entry.teach, others);
  }

  // Lighter load: share of the other courses with a lower load.
  let lighterLoad: number | null = null;
  const ownAverages = subjectAverages(ownSubject);
  if (ownAverages) {
    const mine = tidy(load(ownAverages));
    const otherLoads = subjectRows.flatMap((row) => {
      if (row.course_id === courseId) return [];
      const averages = subjectAverages(row);
      return averages ? [tidy(load(averages))] : [];
    });
    if (otherLoads.length > 0) {
      lighterLoad = Math.round((100 * otherLoads.filter((other) => other < mine).length) / otherLoads.length);
    }
  }

  return { available: true, score, professor, lighterLoad };
}

// Ranks and study tips for the course page. Pure logic: no React, no database, so a client
// component can import it and it is tested on its own. The thresholds of studyPlan are the
// ones of the approved demo (index.html).
import {
  courseScore,
  load,
  scoreWithProfessor,
  teach,
  type ProfessorAverages,
  type ProfessorStatsRow,
  type SubjectAverages,
  type SubjectStatsRow,
} from "./score";

// Same idea as the private tidy() in score.ts: float noise must not decide a comparison.
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export type Rank = { rank: number; of: number };

export type CourseRanks = {
  /** False when the averages of all courses could not be read in full: no ranks are shown. */
  available: boolean;
  /** By professor id (this course's visible professors): rank of this course's combined score with that professor among all courses that have a combined score. */
  score: Record<string, Rank>;
  /** By professor id: rank of that professor's teaching score (teach) on this course among every visible professor row with enough votes, across all courses. */
  professor: Record<string, Rank>;
  /** Whole percentage (0 to 100) of the other courses with enough subject votes whose load is lower than this course's. Null when this course has too few subject votes or no other course qualifies. */
  easierThan: number | null;
};

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

// 1 + the number of other values that are strictly better (higher).
function rankOf(value: number, others: readonly number[]): Rank {
  const mine = tidy(value);
  return { rank: 1 + others.filter((other) => tidy(other) > mine).length, of: others.length + 1 };
}

export function courseRanks(
  courseId: string,
  subjectRows: readonly SubjectStatsRow[],
  professorRows: readonly ProfessorStatsRow[],
): CourseRanks {
  const visibleRows = professorRows.filter((row) => !row.hidden);

  // Score: the default-professor score of every other course.
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

  // Easier than: share of the other courses with a lower load.
  let easierThan: number | null = null;
  const ownAverages = subjectAverages(ownSubject);
  if (ownAverages) {
    const mine = tidy(load(ownAverages));
    const otherLoads = subjectRows.flatMap((row) => {
      if (row.course_id === courseId) return [];
      const averages = subjectAverages(row);
      return averages ? [tidy(load(averages))] : [];
    });
    if (otherLoads.length > 0) {
      easierThan = Math.round((100 * otherLoads.filter((other) => other < mine).length) / otherLoads.length);
    }
  }

  return { available: true, score, professor, easierThan };
}

export type StudyPlan = { line: string; tips: string[] };

export function studyPlan(subject: SubjectAverages, professor: ProfessorAverages): StudyPlan {
  const dif = tidy(subject.difficulty);
  const exam = tidy(subject.exam_level);
  const int = tidy(subject.interest);
  const eng = tidy(professor.engagement);
  const und = tidy(professor.understanding);
  const app = tidy(professor.approachability);
  const L = tidy(load(subject));
  const T = tidy(teach(professor));

  const a =
    L >= 8.5
      ? "One of the most demanding subjects here"
      : L >= 7.5
        ? "A demanding subject"
        : L >= 6
          ? "A moderate workload"
          : "A light workload";
  const b =
    T >= 9
      ? "taught by one of the best."
      : T >= 8
        ? "with teaching you can lean on."
        : T >= 7
          ? "with teaching that only gets you part of the way."
          : "and you will carry most of it yourself.";

  const tips: string[] = [];
  tips.push(
    L >= 7.5
      ? "Start in week one. Falling behind in this course is expensive."
      : L >= 5.5
        ? "Keep a steady weekly rhythm. Cramming works badly here."
        : "The material is light. A few focused hours a week are enough.",
  );
  tips.push(
    tidy(exam - dif) >= 0.3 && exam >= 7
      ? "The exam is tougher than the coursework. Practise old exams early."
      : exam >= 7.5
        ? "Expect a hard exam. Do timed practice exams in the last three weeks."
        : exam < 5.5
          ? "The exam is fair. Follow the coursework and you are prepared."
          : "The exam matches the coursework. Redo the tutorials before it.",
  );
  tips.push(
    und < 7
      ? "Explanations often do not land. Pair the lectures with the book and a study group."
      : eng >= 8.5 && und >= 8.5
        ? "Go to the lectures. They are the fastest way through the material."
        : eng < 7.5
          ? "Lectures are dry. Skim the slides beforehand so you can follow."
          : "Lectures are useful. Attend the ones that open a new topic.",
  );
  if (app >= 8.5) tips.push("The professor is easy to reach. Bring your questions to office hours.");
  else if (app < 7) tips.push("The professor is hard to reach. Take questions to the teaching assistants.");
  if (int < 7) tips.push("Students find the topic dry. Short, regular sessions beat long ones.");

  return { line: `${a}, ${b}`, tips: tips.slice(0, 4) };
}

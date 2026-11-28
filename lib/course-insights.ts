// Ranks and study tips for the course page. Pure logic: no React, no database, so a client
// component can import it and it is tested on its own. The ranks themselves are worked out
// by the database (course_ranks()); here they are only put into the shape the card uses.
// The thresholds of studyPlan are the ones of the approved demo (index.html).
import { load, teach, type ProfessorAverages, type SubjectAverages } from "./score";

// Same idea as the private tidy() in score.ts: float noise must not decide a comparison.
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

export type Rank = { rank: number; of: number };

export type CourseRanks = {
  /** False when the ranks could not be read: no rank tiles are shown. */
  available: boolean;
  /** By professor id: rank of this course's difficulty (the combined score) with that professor among all courses that have one. Rank 1 is the hardest. */
  score: Record<string, Rank>;
  /** By professor id: rank of that professor's teaching score on this course among every visible professor of every course with enough votes. Rank 1 is the best. */
  professor: Record<string, Rank>;
  /** Whole percentage (0 to 100) of the other courses with enough subject votes that have a lighter load (a lower load, not a lower overall difficulty) than this course. Null when this course has too few subject votes or no other course qualifies. */
  lighterLoad: number | null;
};

/** A row of the database function course_ranks(): one per visible professor of the course, or one with an empty professor_id for a course without one. */
export type CourseRankRow = {
  professor_id: string | null;
  score_rank: number | null;
  score_of: number | null;
  teach_rank: number | null;
  teach_of: number | null;
  lighter_load: number | null;
};

/** The ranks of one course as the card uses them, from the rows of course_ranks(). */
export function ranksFromRows(rows: readonly CourseRankRow[]): CourseRanks {
  const ranks: CourseRanks = { available: true, score: {}, professor: {}, lighterLoad: null };
  for (const row of rows) {
    // The share of lighter courses belongs to the course: it is the same in every row.
    ranks.lighterLoad = row.lighter_load;
    if (row.professor_id === null) continue;
    if (row.score_rank !== null && row.score_of !== null) {
      ranks.score[row.professor_id] = { rank: row.score_rank, of: row.score_of };
    }
    if (row.teach_rank !== null && row.teach_of !== null) {
      ranks.professor[row.professor_id] = { rank: row.teach_rank, of: row.teach_of };
    }
  }
  return ranks;
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

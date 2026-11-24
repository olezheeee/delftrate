// The one shared score calculation, moved here from the approved demo (index.html).
// Every page that shows a load, a teaching score, a combined score or a verdict uses this
// module, so the numbers are the same everywhere.
//
// Field names match the rows returned by the database functions course_subject_stats()
// and course_professor_stats(), so those rows can be passed in as they are.

/** Subject averages of a course, each 0 to 10. */
export type SubjectAverages = {
  difficulty: number;
  exam_level: number;
  interest: number;
};

/** Averages of one professor on a course, each 0 to 10. */
export type ProfessorAverages = {
  engagement: number;
  understanding: number;
  approachability: number;
};

// Removes floating point noise, so that a mean of exactly 8 counts as 8 and not as
// 7.999999999999999. Used wherever two numbers are compared: the thresholds of the verdict
// and the choice between two professors. The numbers that are shown stay exactly as the
// demo calculates them.
function tidy(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}

/** How demanding the subject is: difficulty and exam level. */
export function load(subject: SubjectAverages): number {
  return (subject.difficulty + subject.exam_level) / 2;
}

/** How good the professor is: the mean of the three professor criteria. */
export function teach(professor: ProfessorAverages): number {
  return (professor.engagement + professor.understanding + professor.approachability) / 3;
}

/** The single rating: mostly teaching, then interest, then how manageable the load is. */
export function combinedScore(subject: SubjectAverages, professor: ProfessorAverages): number {
  return 0.6 * teach(professor) + 0.25 * subject.interest + 0.15 * (10 - load(subject));
}

export type Verdict = "hard-well-taught" | "brace-yourself" | "smooth-ride" | "manageable-solo";

export const VERDICT_LABELS: Record<Verdict, string> = {
  "hard-well-taught": "Hard, but well taught",
  "brace-yourself": "Brace yourself",
  "smooth-ride": "Smooth ride",
  "manageable-solo": "Manageable solo",
};

export function verdict(subject: SubjectAverages, professor: ProfessorAverages): Verdict {
  const hard = tidy(load(subject)) >= 7.5;
  const good = tidy(teach(professor)) >= 8;
  if (hard && good) return "hard-well-taught";
  if (hard) return "brace-yourself";
  if (good) return "smooth-ride";
  return "manageable-solo";
}

// ---------------------------------------------------------------------------
// From database rows to a course's score.
//
// The minimum number of votes is decided in the database (min_votes()). This module never
// compares vote counts itself; it reads the enough_votes flag the database returns.
// ---------------------------------------------------------------------------

// SubjectStatsRow and ProfessorStatsRow are the rows of the two stats functions. The
// generated database types say the same (scripts/db_types.mjs marks the averages as
// nullable, which the generator alone would not).

/** What the score needs from a row of course_subject_stats(). */
export type SubjectStats = {
  [K in keyof SubjectAverages]: number | null;
} & {
  enough_votes: boolean;
};

/** What the score needs from a row of course_professor_stats(). */
export type ProfessorStats = {
  [K in keyof ProfessorAverages]: number | null;
} & {
  professor_id: string;
  hidden: boolean;
  votes: number;
  enough_votes: boolean;
};

/** A full row of course_subject_stats(). The averages are null until there are enough votes. */
export type SubjectStatsRow = SubjectStats & {
  course_id: string;
  difficulty_votes: number;
  exam_level_votes: number;
  interest_votes: number;
  votes: number;
};

/** A full row of course_professor_stats(). The averages are null until there are enough votes. */
export type ProfessorStatsRow = ProfessorStats & {
  course_id: string;
  engagement_votes: number;
  understanding_votes: number;
  approachability_votes: number;
};

export type CourseScore = {
  /** The professor the score was calculated with. */
  professor_id: string;
  load: number;
  teach: number;
  score: number;
  verdict: Verdict;
};

function subjectAverages(stats: SubjectStats): SubjectAverages | null {
  const { difficulty, exam_level, interest } = stats;
  if (!stats.enough_votes || difficulty === null || exam_level === null || interest === null) {
    return null;
  }
  return { difficulty, exam_level, interest };
}

// An admin also receives the averages of hidden professors and of professors below the
// minimum. Neither counts towards a published score, so both are left out here.
function professorAverages(stats: ProfessorStats): ProfessorAverages | null {
  const { engagement, understanding, approachability } = stats;
  if (
    stats.hidden ||
    !stats.enough_votes ||
    engagement === null ||
    understanding === null ||
    approachability === null
  ) {
    return null;
  }
  return { engagement, understanding, approachability };
}

/**
 * The default professor of a course: the best rated one among the professors who are not
 * hidden and have enough votes. Null when the course has no such professor.
 * With equal ratings the professor with more votes wins, then the lower id, so the answer
 * does not depend on the order of the rows.
 */
export function defaultProfessor<T extends ProfessorStats>(professors: readonly T[]): T | null {
  let best: { row: T; teach: number } | null = null;
  for (const row of professors) {
    const averages = professorAverages(row);
    if (!averages) continue;
    const candidate = { row, teach: tidy(teach(averages)) };
    if (
      !best ||
      candidate.teach > best.teach ||
      (candidate.teach === best.teach &&
        (row.votes > best.row.votes ||
          (row.votes === best.row.votes && row.professor_id < best.row.professor_id)))
    ) {
      best = candidate;
    }
  }
  return best ? best.row : null;
}

/**
 * The score of a course with one chosen professor. Null while the subject or the
 * professor has too few votes, or when the professor is hidden.
 */
export function scoreWithProfessor(
  subject: SubjectStats,
  professor: ProfessorStats,
): CourseScore | null {
  const s = subjectAverages(subject);
  const p = professorAverages(professor);
  if (!s || !p) return null;
  return {
    professor_id: professor.professor_id,
    load: load(s),
    teach: teach(p),
    score: combinedScore(s, p),
    verdict: verdict(s, p),
  };
}

/**
 * The score of a course as shown on its card: calculated with the default professor.
 * Null when there is no default professor or the subject has too few votes; such a course
 * has no combined score yet.
 */
export function courseScore(
  subject: SubjectStats,
  professors: readonly ProfessorStats[],
): CourseScore | null {
  const professor = defaultProfessor(professors);
  return professor ? scoreWithProfessor(subject, professor) : null;
}

// What the course sheet shows: the subject block, one block per professor and the combined
// score with each of them. Built from the rows of the two stats functions through the
// shared score module. No React and no database here, so it is tested on its own.
import {
  defaultProfessor,
  load,
  scoreWithProfessor,
  teach,
  type ProfessorAverages,
  type ProfessorStatsRow,
  type SubjectAverages,
  type SubjectStatsRow,
  type Verdict,
} from "./score";

// The six things a student rates, in the order of the approved demo. `key` is the column
// name in the database and the argument name of submit_rating() without its "p_".
export const SUBJECT_CRITERIA = [
  { key: "difficulty", label: "Difficulty", hint: "How hard the material is" },
  { key: "exam_level", label: "Exam level", hint: "How tough the exam is" },
  { key: "interest", label: "Interest", hint: "How interesting the subject is" },
] as const satisfies readonly { key: keyof SubjectAverages; label: string; hint: string }[];

export const PROFESSOR_CRITERIA = [
  { key: "engagement", label: "Engagement", hint: "Makes lectures worth attending" },
  { key: "understanding", label: "Understanding", hint: "Explains so it makes sense" },
  { key: "approachability", label: "Approachability", hint: "Easy to reach and to ask" },
] as const satisfies readonly { key: keyof ProfessorAverages; label: string; hint: string }[];

export type SheetSubject = {
  // The number of votes that counts towards the minimum.
  votes: number;
  // Null until there are enough votes.
  averages: SubjectAverages | null;
  load: number | null;
};

export type SheetProfessor = {
  id: string;
  name: string;
  votes: number;
  // Null until this professor has enough votes.
  averages: ProfessorAverages | null;
  teach: number | null;
  // The combined score of the course with this professor. Null until both the subject and
  // the professor have enough votes.
  combined: { score: number; verdict: Verdict } | null;
};

export type CourseSheet = {
  subject: SheetSubject;
  professors: SheetProfessor[];
  // The professor the sheet starts on: the best rated one with enough votes, otherwise the
  // first one. Null for a course without professors.
  startProfessorId: string | null;
};

function subjectAverages(row: SubjectStatsRow | null): SubjectAverages | null {
  if (!row?.enough_votes) return null;
  const { difficulty, exam_level, interest } = row;
  if (difficulty === null || exam_level === null || interest === null) return null;
  return { difficulty, exam_level, interest };
}

function professorAverages(row: ProfessorStatsRow | undefined): ProfessorAverages | null {
  if (!row?.enough_votes) return null;
  const { engagement, understanding, approachability } = row;
  if (engagement === null || understanding === null || approachability === null) return null;
  return { engagement, understanding, approachability };
}

// `professors` are the course's professors as the database lists them; `subjectRow` and
// `professorRows` are the rows of course_subject_stats() and course_professor_stats() for
// this course. A hidden professor is left out, also for an admin (who does receive it):
// the sheet shows what students see.
export function buildCourseSheet(
  professors: readonly { id: string; name: string; hidden: boolean }[],
  subjectRow: SubjectStatsRow | null,
  professorRows: readonly ProfessorStatsRow[],
): CourseSheet {
  const subject = subjectAverages(subjectRow);
  const visible = professors
    .filter((professor) => !professor.hidden)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  const rowOf = (id: string) => professorRows.find((row) => row.professor_id === id && !row.hidden);

  const sheetProfessors = visible.map((professor): SheetProfessor => {
    const row = rowOf(professor.id);
    const averages = professorAverages(row);
    const combined = subjectRow && row ? scoreWithProfessor(subjectRow, row) : null;
    return {
      id: professor.id,
      name: professor.name,
      votes: row?.votes ?? 0,
      averages,
      teach: averages ? teach(averages) : null,
      combined: combined && { score: combined.score, verdict: combined.verdict },
    };
  });

  const best = defaultProfessor(professorRows.filter((row) => visible.some((p) => p.id === row.professor_id)));
  return {
    subject: { votes: subjectRow?.votes ?? 0, averages: subject, load: subject ? load(subject) : null },
    professors: sheetProfessors,
    startProfessorId: best?.professor_id ?? sheetProfessors[0]?.id ?? null,
  };
}

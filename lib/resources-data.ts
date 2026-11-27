// Reads the study material of a course from content/resources/<CODE>/.
//
// The files are part of the build: the bundler takes every JSON file in that folder along,
// and import() picks the one of the course that was asked for. Nothing is read from disk at
// request time, so this works the same on a laptop and where the site is hosted.
import {
  crossCheck,
  isCourseCode,
  parseExamBooklet,
  parseKnowledgeBooklet,
  parseResources,
  type CourseResources,
  type ExamBooklet,
  type KnowledgeBooklet,
} from "./resources";

export type CourseMaterial = {
  resources: CourseResources | null;
  knowledge: KnowledgeBooklet | null;
  exams: ExamBooklet | null;
};

// A course without the file (every Aerospace course, for one) is the usual case, not an
// error: the import fails and the answer is null.
async function load<T>(file: string, importing: () => Promise<{ default: unknown }>, parse: (value: unknown) => T) {
  let raw: unknown;
  try {
    raw = (await importing()).default;
  } catch {
    return null;
  }
  try {
    return parse(raw);
  } catch (error) {
    // The test in content/resources/ keeps this from happening. If it does, the course card
    // still works, without the part that could not be read.
    console.error(`Study material: ${file} is not valid.`, error);
    return null;
  }
}

export async function getCourseMaterial(code: string): Promise<CourseMaterial> {
  // The code comes from the address bar and ends up in a file path: only a plain course
  // code may pass.
  if (!isCourseCode(code)) return { resources: null, knowledge: null, exams: null };

  const [resources, knowledge, exams] = await Promise.all([
    load(`${code}/resources.json`, () => import(`@/content/resources/${code}/resources.json`), parseResources),
    load(`${code}/knowledge.json`, () => import(`@/content/resources/${code}/knowledge.json`), parseKnowledgeBooklet),
    load(`${code}/exams.json`, () => import(`@/content/resources/${code}/exams.json`), parseExamBooklet),
  ]);
  // A booklet filed under the wrong course is not shown.
  const sound = crossCheck(code, knowledge, exams).length === 0;
  return {
    resources: resources?.course === code ? resources : null,
    knowledge: sound ? knowledge : null,
    exams: sound ? exams : null,
  };
}

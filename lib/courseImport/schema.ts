// Format and validator for the hand-compiled course files in data/courses.
// This file is also run directly by Node's type stripping, so it uses only
// erasable TypeScript and imports only from node: built-ins.
import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

export const PROGRAMMES = ["AE", "CSE"] as const;
export type ProgrammeId = (typeof PROGRAMMES)[number];
export const YEARS = [1, 2, 3] as const;

export interface Course {
  code: string;
  name: string;
  programme: ProgrammeId;
  year: number;
  quarters: number[]; // sorted, unique, 1-4
  professors: string[]; // normalised, unique, in file order
}

export interface ValidationResult {
  courses: Course[];
  errors: string[];
}

const FILE_KEYS = ["programme", "academicYear", "courses"];
const COURSE_KEYS = ["code", "name", "year", "quarters", "professors"];
const CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]*$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// NFC first: the same accented name pasted from a PDF or a Mac can arrive in a decomposed
// form, and the loader matches professors on the exact string.
function normalise(text: string): string {
  return text.normalize("NFC").trim().replace(/\s+/g, " ");
}

// The code as written, trimmed, or "" when it is not a string. Shared by the course check
// and the duplicate-code check so the two can never disagree.
function trimmedCode(raw: unknown): string {
  return isRecord(raw) && typeof raw.code === "string" ? raw.code.trim() : "";
}

function isProgramme(value: unknown): value is ProgrammeId {
  return (PROGRAMMES as readonly unknown[]).includes(value);
}

function describeList(values: readonly number[]): string {
  const head = values.slice(0, -1).join(", ");
  return head ? `${head} or ${values[values.length - 1]}` : String(values[0]);
}

// Validate one course. Returns the course, or null when errors were pushed.
function validateCourse(
  raw: unknown,
  where: string,
  programme: ProgrammeId | null,
  errors: string[],
): Course | null {
  if (!isRecord(raw)) {
    errors.push(`${where}: must be an object`);
    return null;
  }
  const before = errors.length;
  const codeText = trimmedCode(raw);
  const label = `${where}${codeText ? ` (${codeText})` : ""}`;
  const fail = (message: string) => errors.push(`${label}: ${message}`);

  for (const key of Object.keys(raw)) {
    if (!COURSE_KEYS.includes(key)) {
      fail(`unknown key "${key}" (allowed: ${COURSE_KEYS.join(", ")})`);
    }
  }

  let code = "";
  if (typeof raw.code !== "string") {
    fail("code must be a string");
  } else if (codeText === "") {
    fail("code must not be empty");
  } else if (!CODE_PATTERN.test(codeText)) {
    fail("code must use only uppercase letters, digits and hyphens");
  } else {
    code = codeText;
  }

  let name = "";
  if (typeof raw.name !== "string" || raw.name.trim() === "") {
    fail("name must be a non-empty string");
  } else {
    name = normalise(raw.name);
  }

  let year = 0;
  if (
    typeof raw.year !== "number" ||
    !(YEARS as readonly number[]).includes(raw.year)
  ) {
    fail(`year must be ${describeList(YEARS)}`);
  } else {
    year = raw.year;
  }

  let quarters: number[] = [];
  if (!Array.isArray(raw.quarters) || raw.quarters.length === 0) {
    fail("quarters must be a non-empty array of 1, 2, 3 or 4");
  } else if (
    !raw.quarters.every((q) => Number.isInteger(q) && q >= 1 && q <= 4)
  ) {
    fail("quarters must only contain the integers 1, 2, 3 or 4");
  } else if (new Set(raw.quarters).size !== raw.quarters.length) {
    fail("quarters must not contain duplicates");
  } else {
    quarters = [...(raw.quarters as number[])].sort((a, b) => a - b);
  }

  const professors: string[] = [];
  if (!Array.isArray(raw.professors) || raw.professors.length === 0) {
    fail("professors must be a non-empty array of names");
  } else {
    const seen = new Set<string>();
    raw.professors.forEach((p: unknown, i: number) => {
      if (typeof p !== "string" || p.trim() === "") {
        fail(`professors[${i}] must be a non-empty string`);
        return;
      }
      const clean = normalise(p);
      if (seen.has(clean)) {
        fail(`professor "${clean}" is listed more than once`);
        return;
      }
      seen.add(clean);
      professors.push(clean);
    });
  }

  if (errors.length > before || programme === null) return null;
  return { code, name, programme, year, quarters, professors };
}

// Validate several already-parsed files together.
export function validateCourseFiles(
  files: { label: string; data: unknown }[],
): ValidationResult {
  const errors: string[] = [];
  const courses: Course[] = [];
  const firstSeen = new Map<string, string>();
  const duplicated = new Set<string>();
  // Professors by lower-case name: the first spelling seen and where. A second spelling
  // that differs only in capitals is almost always a typing mistake that would create a
  // second professor, so it is reported.
  const professorSpelling = new Map<string, { name: string; where: string }>();
  let firstYear: { value: string; label: string } | null = null;

  for (const { label, data } of files) {
    if (!isRecord(data)) {
      errors.push(`${label}: file must contain a JSON object`);
      continue;
    }
    for (const key of Object.keys(data)) {
      if (!FILE_KEYS.includes(key)) {
        errors.push(`${label}: unknown key "${key}" (allowed: ${FILE_KEYS.join(", ")})`);
      }
    }

    let programme: ProgrammeId | null = null;
    if (!isProgramme(data.programme)) {
      errors.push(`${label}: programme must be one of ${PROGRAMMES.join(", ")}`);
    } else {
      programme = data.programme;
      const base = label.split(/[\\/]/).pop() ?? label;
      if (base.toLowerCase().endsWith(".json")) {
        const expected = base.slice(0, -".json".length);
        if (expected !== programme) {
          errors.push(
            `${label}: programme "${programme}" does not match the file name (expected "${expected}")`,
          );
        }
      }
    }

    const year = data.academicYear;
    const m = typeof year === "string" ? /^(\d{4})-(\d{4})$/.exec(year) : null;
    if (!m || Number(m[2]) !== Number(m[1]) + 1) {
      errors.push(
        `${label}: academicYear must look like 2026-2027 (second year = first year + 1)`,
      );
    } else if (firstYear === null) {
      firstYear = { value: year as string, label };
    } else if (firstYear.value !== year) {
      errors.push(
        `${label}: academicYear is ${year} but ${firstYear.label} says ${firstYear.value}; every file must be for the same academic year`,
      );
    }

    if (!Array.isArray(data.courses)) {
      errors.push(`${label}: courses must be an array`);
      continue;
    }

    data.courses.forEach((raw: unknown, i: number) => {
      const where = `${label}, course #${i + 1}`;
      const course = validateCourse(raw, where, programme, errors);

      // Duplicate check uses the code even when the course has other errors.
      const rawCode = trimmedCode(raw);
      if (rawCode !== "") {
        const first = firstSeen.get(rawCode);
        if (first === undefined) {
          firstSeen.set(rawCode, where);
        } else {
          errors.push(
            `${where} (${rawCode}): code already used by ${first}; a course code may appear only once`,
          );
          duplicated.add(rawCode);
        }
      }
      if (course) {
        const here = `${where} (${course.code})`;
        for (const name of course.professors) {
          const key = name.toLowerCase();
          const first = professorSpelling.get(key);
          if (first === undefined) {
            professorSpelling.set(key, { name, where: here });
          } else if (first.name !== name) {
            errors.push(
              `${here}: professor "${name}" differs only in capitals from "${first.name}" in ${first.where}; write the same person the same way everywhere`,
            );
          }
        }
        courses.push(course);
      }
    });
  }

  return {
    courses: courses.filter((c) => !duplicated.has(c.code)),
    errors,
  };
}

// Read every *.json in dir, parse it and validate all files together.
export function loadCourseFiles(dir?: string): ValidationResult {
  const folder = dir ?? resolve(import.meta.dirname, "..", "..", "data", "courses");
  const files: { label: string; data: unknown }[] = [];
  const errors: string[] = [];

  const names = readdirSync(folder)
    // Case-insensitive, so a file saved as AE.JSON is read and validated instead of being
    // skipped without a word.
    .filter((n) => n.toLowerCase().endsWith(".json"))
    .sort();
  for (const name of names) {
    try {
      files.push({
        label: name,
        data: JSON.parse(readFileSync(join(folder, name), "utf8")),
      });
    } catch (e) {
      const reason = e instanceof Error ? e.message : String(e);
      errors.push(`${name}: could not be read as JSON (${reason})`);
    }
  }

  // Every programme needs its file: a missing one would otherwise be skipped quietly and
  // that programme's courses would not be refreshed.
  const present = new Set(names.map((n) => n.slice(0, -".json".length)));
  for (const programme of PROGRAMMES) {
    if (!present.has(programme)) errors.push(`${programme}.json: file is missing`);
  }

  const result = validateCourseFiles(files);
  return { courses: result.courses, errors: [...errors, ...result.errors] };
}

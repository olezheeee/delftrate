// Writes the course import SQL to supabase/.temp/course_import.sql.
// Run with: npm run db:import:sql
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadCourseFiles } from "./schema.ts";
import { importSql } from "./sql.ts";

const file = resolve(import.meta.dirname, "..", "..", "supabase", ".temp", "course_import.sql");
// Remove the previous run's SQL first: when this run fails, there must be no old file
// left that a following `supabase db query --file` could apply by mistake.
rmSync(file, { force: true });

const { courses, errors } = loadCourseFiles();

if (errors.length > 0) {
  console.error(`The course files have ${errors.length} error(s):`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
if (courses.length === 0) {
  console.error("The data files in data/courses are empty: there is nothing to import.");
  process.exit(1);
}

mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, importSql(courses));

const professors = new Set(courses.flatMap((c) => c.professors));
console.log(`${courses.length} courses and ${professors.size} professors written to ${file}`);

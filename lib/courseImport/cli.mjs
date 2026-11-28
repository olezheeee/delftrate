// Writes the course import to supabase/.temp/course_import.sql, and the query that shows
// the totals afterwards to supabase/.temp/course_totals.sql. Each file holds one statement,
// because `supabase db query --file` runs a file as a single statement.
// Run with: npm run db:import:sql
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { loadCourseFiles } from "./schema.ts";
import { importSql, TOTALS_SQL } from "./sql.ts";

const temp = resolve(import.meta.dirname, "..", "..", "supabase", ".temp");
const file = resolve(temp, "course_import.sql");
const totals = resolve(temp, "course_totals.sql");
// Remove the previous run's SQL first: when this run fails, there must be no old file
// left that a following `supabase db query --file` could apply by mistake.
rmSync(file, { force: true });
rmSync(totals, { force: true });

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
writeFileSync(totals, TOTALS_SQL);

const professors = new Set(courses.flatMap((c) => c.professors));
console.log(`${courses.length} courses and ${professors.size} professors written to ${file}`);

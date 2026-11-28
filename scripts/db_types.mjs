// Regenerates lib/supabase/database.types.ts from the linked (development) Supabase project.
// Run it with `npm run db:types`. The file is only replaced when the generator succeeds, so
// a failed run (not signed in, not linked, no network) leaves the old types in place.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const target = join(root, "lib", "supabase", "database.types.ts");
const header = `// The shape of the database, for the Supabase clients.
//
// This file is replaced, not edited: after a migration is applied to the development
// project, run \`npm run db:types\` (see "The database" in SETUP.md) and commit the result.

`;

// The averages of these functions are null until a block has enough votes. The generator
// cannot know that and types them as plain numbers, so they are corrected here.
const NULLABLE = {
  calendar_scores: ["score", "load", "teach"],
  course_subject_stats: ["difficulty", "exam_level", "interest"],
  course_professor_stats: ["engagement", "understanding", "approachability"],
};

function fail(message) {
  console.error(`\n${message} lib/supabase/database.types.ts is unchanged.`);
  process.exit(1);
}

let types;
try {
  types = execSync("npx supabase gen types --remote --schema public", {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch {
  fail("The types were not generated.");
}
if (!types.includes("export type Database")) fail("The generator returned no types.");

for (const [fn, columns] of Object.entries(NULLABLE)) {
  const block = new RegExp(`\\n {6}${fn}: \\{[\\s\\S]*?\\n {6}\\}`).exec(types);
  if (!block) fail(`The function ${fn} is missing from the generated types.`);
  let fixed = block[0];
  for (const column of columns) {
    const line = new RegExp(`(\\n\\s+${column}: number)(?! \\| null)`);
    if (!line.test(fixed)) fail(`The column ${column} of ${fn} is not where it was expected.`);
    fixed = fixed.replace(line, "$1 | null");
  }
  types = types.replace(block[0], fixed);
}

writeFileSync(target, header + types);
console.log("Wrote lib/supabase/database.types.ts");

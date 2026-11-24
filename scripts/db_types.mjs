// Regenerates lib/supabase/database.types.ts from the linked (development) Supabase project.
// Run it with `npm run db:types`. The file is only replaced when the generator succeeds, so
// a failed run (not signed in, not linked, no network) leaves the old types in place.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const target = "lib/supabase/database.types.ts";
const header = `// The shape of the database, for the Supabase clients.
//
// This file is replaced, not edited: after a migration is applied to the development
// project, run \`npm run db:types\` (see "The database" in SETUP.md) and commit the result.

`;

let types;
try {
  types = execSync("supabase gen types --remote --schema public", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
} catch {
  console.error(`\nThe types were not generated. ${target} is unchanged.`);
  process.exit(1);
}
if (!types.includes("export type Database")) {
  console.error(`The generator returned no types. ${target} is unchanged.`);
  process.exit(1);
}
writeFileSync(target, header + types);
console.log(`Wrote ${target}`);

# Setup from zero (Windows)

This takes you from an empty Windows computer to your first DelftRate briefing. It takes about 20 minutes. Every command goes into **Command Prompt**: press the Windows key, type `cmd`, press Enter.

On a Mac, open **Terminal** instead. Install the tools with [Homebrew](https://brew.sh) (`brew install git gh node python` and `brew install --cask claude-code`), skip steps 1 to 4, and continue from step 5. Where a command says `cd %USERPROFILE%\Documents`, type `cd ~/Documents` instead.

## Before you start

You need three accounts:

- **GitHub.** Create one at [github.com/signup](https://github.com/signup) if you have none.
- **Your username sent to Oleg.** He adds it to the team list and you get an invitation by email. Without this step the project does not know who you are.
- **A paid Claude account** (Pro, Max, Team or Console). The free claude.ai plan does not include Claude Code.

## 1. Install Git

```
winget install --id Git.Git -e
```

Git keeps the history of the code. Claude Code also uses the Git Bash that comes with it.

## 2. Install the GitHub CLI

```
winget install --id GitHub.cli -e
```

This gives you the `gh` command, which our scripts use to read tasks and pull requests.

## 3. Install Python and Node.js

Type this and press Enter:

```
python3
```

If Python is missing, the Microsoft Store opens on the Python page. Press **Get**. Install it this way and not from python.org, because our scripts call `python3` and only the Store version adds that command.

If Python is already installed, you see `>>>` instead. Type `exit()` and press Enter to get back to cmd.

Then install Node.js, which runs the app itself:

```
winget install --id OpenJS.NodeJS.LTS -e
```

## 4. Install Claude Code

```
curl -fsSL https://claude.ai/install.cmd -o install.cmd && install.cmd && del install.cmd
```

It shows no progress while it downloads; wait for it to finish. You do not need to run it as Administrator.

## 5. Close cmd and open it again

The new commands only work in a new window. Check all five:

```
git --version
gh --version
python3 --version
node --version
claude --version
```

Each line should print a version number; for `node` it must be 24 or higher. If one says "is not recognized", repeat its install step and open a new window again.

## 6. Sign in to GitHub — this is how you select who you are

```
gh auth login
```

Answer the questions like this:

1. Where do you use GitHub? **GitHub.com**
2. Preferred protocol? **HTTPS**
3. Authenticate Git with your GitHub credentials? **Yes**
4. How would you like to authenticate? **Login with a web browser**

Copy the code it shows, press Enter, paste the code in the browser and approve.

There is no user menu in DelftRate. The project reads the account you signed in with here and looks it up in the team list, so sign in with the same username you sent to Oleg. To check which account is active:

```
gh api user -q .login
```

## 7. Accept the invitation

Open [github.com/olezheeee/delftrate/invitations](https://github.com/olezheeee/delftrate/invitations) and press **Accept invitation**. The same link is in the email from GitHub. If the page says there is no invitation, Oleg has not added your username yet.

## 8. Download the project

```
cd %USERPROFILE%\Documents
gh repo clone olezheeee/delftrate
cd delftrate
npm install
```

The project is now in `Documents\delftrate`. `npm install` downloads the libraries the app needs; it takes a minute. After it, `npm run dev` starts the app at http://localhost:3000.

## 9. Start Claude Code

Always start it from inside the project folder:

```
claude
```

The first time, a browser opens: sign in with your Claude account. Then Claude asks whether you trust the folder; answer yes.

## 10. Run your first briefing

Inside Claude Code, type:

```
/start-session
```

The second line must show your name and role, for example `Signed in as Ariv (Coder)`. Below it you see the overall progress, the last changes and your own tasks. Leads also see the whole team.

If it shows `@yourusername (not in .github/team.json yet)`, you are signed in to GitHub with an account that is not on the team list. Send Oleg the username from step 6, or sign in with the right one:

```
gh auth logout
gh auth login
```

## Every day after this

```
cd %USERPROFILE%\Documents\delftrate
claude
```

Then `/start-session`. To open a task of your own, type `/new-task` followed by what you are going to do. How tasks, branches and reviews work is in [CONTRIBUTING.md](CONTRIBUTING.md).

## If something goes wrong

| What you see | What to do |
|---|---|
| `'winget' is not recognized` | Install **App Installer** from the Microsoft Store, then open a new cmd window. |
| `The token '&&' is not a valid statement separator` | You are in PowerShell. Open `cmd` instead. |
| `'claude' is not recognized` after installing | Close every cmd window and open a new one. |
| `>>>` appears and commands give `SyntaxError` | You are inside Python. Type `exit()` and press Enter. |
| `'npm' is not recognized` | Node.js is missing. Repeat the Node.js install in step 3 and open a new cmd window. |
| `python3` opens the Store every time | Python is not installed yet. Press **Get** in the Store. |
| `gh repo clone` says the repository was not found | Accept the invitation in step 7 first. |
| `/start-session` is an unknown command | You started `claude` outside the project folder. Leave with `/exit`, run `cd %USERPROFILE%\Documents\delftrate`, start again. |

## The database

Coders do not need this section to start working: `npm test` builds a throwaway database from the migration files on your own computer, with nothing to install. The steps below are for a lead who applies the schema to a Supabase project.

The whole schema lives in `supabase/migrations`: the tables, the access rules and the averages. A Supabase project gets its schema only from these files. Do not create or change tables in the Supabase dashboard, and do not edit a migration that is already merged. To change the schema, add a new file:

```
npx supabase migration new short_name_of_the_change
```

Write the SQL in the file it creates, add tests to `supabase/database.test.ts`, and open a pull request with the `fable-review` label.

Everything a migration adds starts closed. A new table needs its own `grant` and policies before the site can read it, and a new function needs `grant execute ... to authenticated` before anyone can call it. This also holds for a helper function outside `public` that a policy or a check on a table uses.

`supabase/config.jsonc` only describes a database running on your own computer. It is not our project's settings: sign-in, email and the rest are set in the Supabase dashboard (see "Sign-in and email settings" below). Never run `npx supabase config push`.

We have two Supabase projects, **development** and **production**. Both get the schema from the same files, and a brand-new project reaches the full schema with the four steps below. The project folder is always linked to the **development** project; production is never linked, it is named in the command each time.

1. Sign in to Supabase once per computer. A browser opens.

   ```
   npx supabase login
   ```

2. Point the folder at the development project. The project ref is the first part of the project URL: for `https://abcdefghijklmnopqrst.supabase.co` it is `abcdefghijklmnopqrst`. It asks for the database password of that project.

   ```
   npx supabase link --project-ref abcdefghijklmnopqrst
   ```

3. Apply the migrations. It lists the files it is going to run and asks before running them. Files that were applied earlier are skipped.

   ```
   npm run db:push
   ```

4. Check the result: in the Supabase dashboard, Table Editor shows the tables (`courses`, `professors`, `profiles` and the others), each marked as protected by row level security.

**Development project only: example data.** This loads a few fictional courses, professors and votes, so the pages have something to show before the real course import. Never run it on production.

```
npx supabase db push --remote --include-seed
```

**After a new migration is applied to development,** refresh the TypeScript types and commit the file it rewrites (`lib/supabase/database.types.ts`):

```
npm run db:types
```

**Production** gets the same migrations, without the example data. Do not link the folder to it. Name the production project ref in the command instead, so no later command can reach production by accident:

```
npx supabase db push --remote=productionprojectref
```

**Making someone an admin.** The admin flag cannot be set from the site. In the Supabase dashboard, open SQL Editor and run this with the person's email address. They must have finished registering, including the programme and year.

```
update public.profiles set is_admin = true
where id = (select id from auth.users where email = 'name@student.tudelft.nl')
returning id;
```

It answers with one row. If it answers with no rows, nothing was changed: the email address is wrong, or the person has not finished registering.

## Sign-in and email settings

These are set by a lead in the Supabase dashboard, once per project (development and production). The site expects exactly these values; with different ones registration does not work.

Under **Authentication**:

| Where | Setting | Value |
|---|---|---|
| Sign In / Providers, Email | Confirm email | on |
| Sign In / Providers, Email | Minimum password length | 8 |
| Sign In / Providers, Email | Email OTP length | 6 |
| Sign In / Providers, Email | Email OTP expiration | 3600 seconds |
| Emails, SMTP Settings | Enable custom SMTP | on |
| Emails, SMTP Settings | Host, port, username | `smtp.resend.com`, `465`, `resend` |
| Emails, SMTP Settings | Password | the Resend API key (Oleg has it) |
| Emails, SMTP Settings | Sender email, sender name | `onboarding@resend.dev` for now, `DelftRate` |
| Emails, Templates, Confirm sign up | Subject, body | `Your DelftRate code`, the contents of `supabase/templates/confirmation.html` |
| Emails, Templates, Reset password | Subject, body | `Your DelftRate password reset code`, the contents of `supabase/templates/recovery.html` |
| Rate Limits | Emails sent per hour | 30 (raised for launch) |
| Rate Limits | Sign-ups and sign-ins, token verifications | see below |

Our emails carry a six-digit code that the student types on the site. They contain no link on purpose: the university's mail filter opens links in incoming mail to check them, which would use up a one-time link before the student sees it.

`onboarding@resend.dev` is Resend's test sender. It delivers only to the email address the Resend account was created with, so until our own domain is verified in Resend, only that one address can register. After the domain is verified, change the sender email to an address on it.

Supabase limits sign-ups, sign-ins and code checks per internet address (30 per 5 minutes by default). Our site sends these requests from its own server, so Supabase may count all students together as one address. Before launch, check how the limits behave with several people registering at once and raise them if needed; this is part of the abuse protection in Pack 7.

The length of the code and of the password are also written in `lib/auth/validation.ts`. Change them in both places or not at all.

## Importing the courses

The course lists in `data/courses` (`AE.json` and `CSE.json`) are written into the database by an import. Only a lead runs it. It needs the steps of "The database" first.

What the import does: it adds new courses, updates the name, programme and year of courses it already knows (matched on the course code), adds professors it does not know yet (matched on the exact name) and links each professor to their courses. It is one statement: everything is written, or nothing is.

What it never does: it never deletes or hides a course, a professor or a link, even when they are missing from the files. Deleting a link would delete the ratings on it. So a professor who stops teaching one course stays linked to it after the next import. Hiding the professor is not the answer: it hides them, and their ratings, on every course. Until there is a way to retire a single link, ask Oleg before removing one by hand. If one name matches two professors in the database, the import stops with an error naming them and changes nothing.

Run it for the development project:

1. Check the files and make the SQL files (it fails, and tells you why, if the files are wrong):

   ```
   npm run db:import:sql
   ```

2. Write it to the development project, then show the totals. It asks for confirmation first.

   ```
   npm run db:import
   ```

For production, make the files and run them with the project ref in the command:

```
npm run db:import:sql && npx supabase db query --remote=productionprojectref --file supabase/.temp/course_import.sql && npx supabase db query --remote=productionprojectref --file supabase/.temp/course_totals.sql
```

Keep it as one line: each `&&` runs the next part only when the one before it succeeded. (A failed check also deletes the old SQL files, so nothing stale can be sent.) Each file holds a single statement, because `supabase db query --file` runs a file as one statement.

**Try it locally first.** With a local Supabase running (`npx supabase start`, needs Docker), the same two files run without `--remote` and touch only your own computer: `npx supabase db query --file supabase/.temp/course_import.sql`.

**Development project with example data:** if the development project has the example data from `seed.sql`, a real course whose code is also an example code (such as `AE2001`) takes over that example course, with its fictional professors and votes. Before the first real import, reset the development project without the seed.

**Every new academic year:**

1. Change `academicYear` in both files.
2. Compile the new lists by hand, as described in `data/courses/README.md`.
3. Run `npm test`.
4. Run the import for development, then for production.

**Check the result.** After the import, the totals are printed: courses, professors and course_professors. Run the import a second time: the totals must be the same.

Quarters are in the files, but the import does not write them yet. A course it adds has no quarters and does not show in the calendar on the home page until that is built; a course that was already there keeps the quarters it had.

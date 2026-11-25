# DelftRate

Course and professor ratings for TU Delft students. `index.html` is the approved demo; the real app is built from here.

## Stack

Next.js (App Router, TypeScript) in `app/`, Supabase clients in `lib/supabase/`, Vitest for tests. Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` before marking a pull request ready. Components that call the Supabase server client must sit inside `<Suspense>` (`cacheComponents` is on). Next.js conventions for this version: see `AGENTS.md`.

## Team rules (follow these in every session)

- Two long-lived branches: `develop` (daily work, default) and `main` (releases).
- Never commit or push to `main` or `develop` directly. All work happens on a `task/...` branch and reaches `develop` through a pull request.
- Every pull request has a description and an owner. Open one with `/new-task` (or `python3 scripts/new_task.py`).
- Only leads (Oleg, Chad, Oreo) release `develop` into `main`. The release pull request is an important review (see Models): Oleg runs `/code-review` on it in a session on Fable 5.2, including when he opened it himself, and what it finds is fixed. After that, any lead can merge it.
- Start every working session with `/start-session`. Work on a task with `/work-task`.
- Team members and their roles live in `.github/team.json`.

## Models (follow these in every session)

Which model does the work depends on the task. Check this before you build or review anything.

- **Fable tasks** are the pull requests labelled `fable`: the most complex work. Only Oleg owns them, and he builds them only in a session running Fable 5.2.
- **Important reviews** are done only by Oleg, with `/code-review` in a session running Fable 5.2. They are: every release pull request (`develop` into `main`), every pull request labelled `fable-review`, and his own Fable tasks. Nobody merges one of these before that review.
- If the task or review in front of you is one of the above and you are not Fable 5.2 in Oleg's session, do not start it. Say whose it is and stop. Your system prompt names the model you are; `gh api user -q .login` and `.github/team.json` tell you whose session this is.
- **Regular tasks** are everything else, for every team member including the leads. They follow `/work-task`: the session runs on Opus, which plans the task; `builder` agents (Sonnet, `.claude/agents/builder.md`) do the building; Opus then reviews the result locally and fixes what it finds, before the pull request is marked ready. Do not build a regular task on another model, and do not skip the plan or the review.
- Sessions in this repository start on Opus (`.claude/settings.json`). Oleg keeps Fable 5.2 through his own `.claude/settings.local.json`.
- Oleg decides which tasks get the `fable` label. Anyone may add `fable-review` to a pull request that touches database access rules, sign-in or the admin panel; only Oleg removes it.

Details: `CONTRIBUTING.md`.

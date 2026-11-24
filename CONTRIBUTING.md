# How we work

## Team

| Name | Role |
|---|---|
| Oleg | Team lead |
| Chad | Support code lead |
| Oreo | Code lead |
| Adi, Ariv, Sahil, Jose | Coders |

GitHub usernames and roles are in `.github/team.json`. The start-session briefing reads that file to decide what to show you.

## Branches

- `main` — released, working code. Changes arrive only as a pull request from `develop`, reviewed and merged by a lead.
- `develop` — where finished tasks come together. Default branch. Changes arrive only through pull requests.
- `task/<name>` — one branch per task, created from `develop`.

## The cycle

1. **Meeting.** We outline the work.
2. **Oleg hands out tasks.** Each task is a draft pull request into `develop` with a description and one owner:
   ```bash
   python3 scripts/new_task.py "Course search API" --to Adi --due 2026-12-05 --body "What to build and what done looks like"
   ```
3. **Anyone can open their own task** when something comes up. Write the description yourself; the PR is assigned to you automatically:
   ```bash
   python3 scripts/new_task.py "Fix slider on Safari" --body "What I am going to do"
   ```
   A PR opened on github.com without an assignee is also assigned to its author.
4. **Work on it.**
   ```bash
   git fetch && git switch task/course-search-api
   ```
   Then run `/work-task` in Claude Code. It plans the task, builds it and reviews it with the right models (see "Models" below). Commit and push to that branch. When it is finished, press **Ready for review** on the PR.
5. **Review and merge into `develop`.** A teammate reviews; then it is merged. A PR labelled `fable-review` is reviewed by Oleg and is not merged before that.
6. **Release.** A lead (Oleg, Chad or Oreo) opens a PR from `develop` into `main`. Oleg reviews it, including when he opened it himself:
   - run the code review on the PR (`/code-review` in Claude Code, in a session on Fable 5.2);
   - fix what it finds, through a `task/...` pull request into `develop`, and wait for the checks to pass.

   After that, any lead can merge the PR into `main`. GitHub only allows the merge while the `checks` job on the PR is green.

## Models

Three Claude models do the work, and which one depends on the task. Claude Code reads these rules from `CLAUDE.md` in every session, so it will stop you if the task in front of it belongs to another model.

| Work | Who | Model |
|---|---|---|
| **Fable task**: a PR labelled `fable` (the most complex work) | Oleg only | Fable 5.2 |
| **Important review**: every release PR, every PR labelled `fable-review`, and Oleg's own Fable tasks | Oleg only | Fable 5.2, with `/code-review` |
| **Regular task**: everything else | The owner of the PR | Opus plans and reviews, Sonnet builds |

**Regular tasks.** On your task branch, run `/work-task`. It goes through three steps:

1. **Plan.** Opus reads the task and the code, splits the work into pieces and shows you the plan. Nothing is built until you agree.
2. **Build.** Opus hands each piece to a `builder` agent running on Sonnet. Independent pieces are built at the same time.
3. **Review and fix.** Opus reads the whole change, runs lint, typecheck, the tests and the build, runs the code review, and fixes what it finds itself.

Claude Code starts on Opus in this repository (`.claude/settings.json`), so you do not have to choose a model. If you switched to another one, `/model opus` brings you back.

**Fable tasks and important reviews.** These go to Oleg because he has access to Fable 5.2. Do not start one in your own session; `/work-task` refuses it. In the briefing they are marked `FABLE TASK (Oleg only)` and `FABLE REVIEW (Oleg)`.

**Labels.** Oleg decides which tasks get `fable`. Anyone may add `fable-review` to a PR that touches database access rules, sign-in or the admin panel (`gh pr edit <number> --add-label fable-review`); only Oleg removes it.

## Start of every session

In Claude Code:

```
/start-session
```

Or in a terminal:

```bash
python3 scripts/start_session.py
```

- **Coders** see overall progress, the last changes and their own schedule.
- **Leads** see overall progress, the last changes, freshly done PRs, PRs ready for review, newly created PRs and the schedule of every team member.

A line `Due: 2026-12-05` in a PR description puts a date on the task in the schedule.

## First-time setup

Follow [SETUP.md](SETUP.md): it goes from an empty computer to your first briefing.

## For leads: adding people

Put the GitHub usernames in `.github/team.json`, run `python3 scripts/sync_team.py` (sends the invitations and updates `CODEOWNERS`), then commit both files through a pull request.

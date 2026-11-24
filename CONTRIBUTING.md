# How we work

## Team

| Name | Role |
|---|---|
| Oleg | Team lead |
| Chad | Support code lead |
| Oreo | Code lead |
| Ariv, Sahil | Coders |

GitHub usernames and roles are in `.github/team.json`. The start-session briefing reads that file to decide what to show you.

## Branches

- `main` — released, working code. Changes arrive only as a pull request from `develop`, reviewed and merged by a lead.
- `develop` — where finished tasks come together. Default branch. Changes arrive only through pull requests.
- `task/<name>` — one branch per task, created from `develop`.

## The cycle

1. **Meeting.** We outline the work.
2. **Oleg hands out tasks.** Each task is a draft pull request into `develop` with a description and one owner:
   ```bash
   python3 scripts/new_task.py "Course search API" --to Ariv --due 2026-12-05 --body "What to build and what done looks like"
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
   Commit and push to that branch. When it is finished, press **Ready for review** on the PR.
5. **Review and merge into `develop`.** A teammate reviews; then it is merged.
6. **Release.** A lead opens a PR from `develop` into `main`. Any lead (Oleg, Chad or Oreo) can review it, including the lead who opened it:
   - run the code review on the PR (`/code-review` in Claude Code);
   - fix what it finds, through a `task/...` pull request into `develop`, and wait for the checks to pass.

   After that, any lead can merge the PR into `main`. GitHub only allows the merge while the `checks` job on the PR is green.

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

# DelftRate

Course and professor ratings for TU Delft students. `index.html` is the approved demo; the real app is built from here.

## Team rules (follow these in every session)

- Two long-lived branches: `develop` (daily work, default) and `main` (releases).
- Never commit or push to `main` or `develop` directly. All work happens on a `task/...` branch and reaches `develop` through a pull request.
- Every pull request has a description and an owner. Open one with `/new-task` (or `python3 scripts/new_task.py`).
- Only leads (Oleg, Chad, Oreo) release `develop` into `main`, and only after an approving review from a lead.
- Start every working session with `/start-session`.
- Team members and their roles live in `.github/team.json`.

Details: `CONTRIBUTING.md`.

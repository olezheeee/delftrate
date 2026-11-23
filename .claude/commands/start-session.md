---
description: Team briefing — overall progress, last changes and your schedule (leads see the whole team)
allowed-tools: Bash(python3 scripts/start_session.py:*), Bash(git fetch:*), Bash(git status:*)
---

Run `python3 scripts/start_session.py $ARGUMENTS` from the repository root and show its output to the user exactly as printed, in a code block. Do not summarise it away.

Then add at most three lines:
- For a coder: name the task they should pick up first (the top of "Your schedule") and offer to switch to its branch (`git fetch && git switch <branch>`).
- For a lead: point out anything that needs a decision today (PRs ready for review, overdue tasks, people with nothing assigned).

If the script fails because `gh` is missing or not logged in, tell the user to install the GitHub CLI and run `gh auth login`, and stop.

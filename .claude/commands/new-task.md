---
description: Open a task as a draft PR into develop — for yourself, or (leads) for a teammate
allowed-tools: Bash(python3 scripts/new_task.py:*)
---

The user wants to open a task: $ARGUMENTS

Work out the title, the owner (a name from `.github/team.json`; nobody named means the user themself), an optional due date, and a description that says what should exist when the task is done. If the description is missing, ask for it — every task needs one. Then run:

`python3 scripts/new_task.py "<title>" [--to <name>] [--due YYYY-MM-DD] --body "<description>"`

Show the PR link and the branch name it prints.

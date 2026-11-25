---
description: Work on this branch's task with the team's model workflow — Opus plans, Sonnet builders build, Opus reviews and fixes
---

Work on the task of the current branch, following the "Models" rules in `CLAUDE.md`. Extra instructions from the user, if any: $ARGUMENTS

## 1. Find the task and check that this session may do it

Run `gh pr view --json number,title,body,labels,assignees,url` and `gh api user -q .login`.

If the current branch is `develop` or `main`, or it has no pull request, stop. Tell the user to switch to their task branch (`git fetch && git switch task/...`) or to open a task with `/new-task`.

Then look at the labels:

- **Labelled `fable`: a Fable task.** Continue only if both are true: the signed-in GitHub user is Oleg (the member named Oleg in `.github/team.json`), and you are running as Fable 5.2 (your system prompt names your model). If either is false, change nothing, say that this task is Oleg's and is done only on Fable 5.2, and stop. If both are true, do the work yourself, skip steps 2 and 3, and continue at step 4.
- **Anything else: a regular task.** You must be running as an Opus model. If you are not, change nothing, ask the user to run `/model opus` and then `/work-task` again, and stop.

## 2. Plan (you, on Opus)

- Read the pull request description, the code it touches and, for Next.js work, the relevant guide in `node_modules/next/dist/docs/` (see `AGENTS.md`).
- Work out what is already done on this branch (`git log develop..HEAD`, the ticked boxes in the description).
- Split the remaining work into pieces for builders. Each piece has one clear outcome and a list of the files it owns. Two pieces that run at the same time never touch the same file. Note the order where one piece needs the result of another.
- For a pack, plan the next few boxes of the checklist, not the whole pack in one go.
- Show the plan to the user as a short list and wait for their go-ahead before building.

## 3. Build (builder agents, on Sonnet)

- Start one `builder` agent per piece with the Agent tool (`subagent_type: "builder"`). Send independent pieces in a single message so they run in parallel; start dependent pieces after the ones they need.
- Every brief stands on its own: the goal, the files the builder may create or change, the conventions that apply, what done looks like, and what to report back. The builder knows nothing you do not write down.
- Do not write the feature code yourself in this step. If a builder comes back stuck or wrong, correct it with SendMessage or start a new builder with a better brief.
- If the `builder` agent type is not available in this session, use the general-purpose agent with `model: "sonnet"` and paste the rules from `.claude/agents/builder.md` into the brief.

## 4. Review and fix (you, on Opus — or on Fable 5.2 for a Fable task)

- Read the whole change yourself: `git diff develop...HEAD` plus what is not committed yet.
- Run `npm run lint`, `npm run typecheck`, `npm test` and `npm run build`.
- Run the `code-review` skill at `high` on the change.
- Fix what the checks and the review find yourself. Do not hand fixes back to builders. Repeat until the checks pass and the review is clean.

## 5. Hand over

- Commit on the task branch (never on `develop` or `main`) and push.
- Tick the boxes in the pull request description that are now done.
- If the pull request is labelled `fable-review`, or this work changed database access rules (`supabase/`), sign-in code or the admin panel, make sure the `fable-review` label is on it (`gh pr edit --add-label fable-review`) and tell the user that Oleg reviews it on Fable 5.2 before it is merged.
- When every box is ticked and the checks pass, ask the user whether to mark the pull request ready for review.
- Finish with a short report: what was built, the result of the checks, what the review found and fixed, and what is left.

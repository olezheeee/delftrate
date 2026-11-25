#!/usr/bin/env python3
"""Open a task: a draft pull request into develop with a description and an owner.

A lead hands a task to someone:
    python3 scripts/new_task.py "Course search API" --to Ariv --due 2026-12-05 --body "What to build ..."
A coder opens a task for themselves (it is assigned to them):
    python3 scripts/new_task.py "Fix slider on Safari" --body "What I am going to do ..."

It creates the branch task/<title> on GitHub and does not touch your local files.
Afterwards the owner runs:  git fetch && git switch task/<title>
"""
import argparse
import json
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def gh(*args, check=True):
    r = subprocess.run(("gh",) + args, cwd=ROOT, capture_output=True, text=True)
    if r.returncode and check:
        sys.exit(f"gh {' '.join(args[:3])} failed:\n{r.stderr.strip()}")
    return r.stdout.strip() if r.returncode == 0 else None


def main():
    ap = argparse.ArgumentParser(description="Open a task as a draft pull request into develop.")
    ap.add_argument("title")
    ap.add_argument("--to", help="team member name or GitHub username (default: you)")
    ap.add_argument("--body", default="", help="description of the task (required: say what done looks like)")
    ap.add_argument("--due", help="optional due date, YYYY-MM-DD")
    a = ap.parse_args()
    if not a.body.strip():
        sys.exit("Every task needs a description. Add --body \"what should exist when this is done\".")
    if a.due and not re.fullmatch(r"\d{4}-\d{2}-\d{2}", a.due):
        sys.exit("--due must look like 2026-12-05.")

    with open(os.path.join(ROOT, ".github", "team.json")) as f:
        team = json.load(f)
    repo, me = team["repo"], gh("api", "user", "-q", ".login")
    owner = me
    if a.to:
        m = next((m for m in team["members"] if a.to.lower() in (m["name"].lower(), m["github"].lower())), None)
        if m and not m["github"]:
            sys.exit(f"{m['name']} has no GitHub username in .github/team.json yet.")
        owner = m["github"] if m else a.to.lstrip("@")

    slug = re.sub(r"[^a-z0-9]+", "-", a.title.lower()).strip("-")[:48]
    branch = f"task/{slug}"
    if gh("api", f"repos/{repo}/git/ref/heads/{branch}", check=False):
        sys.exit(f"Branch {branch} already exists. Pick a different title.")

    # A PR needs one commit that develop does not have: add an empty one on a new branch.
    base = json.loads(gh("api", f"repos/{repo}/git/ref/heads/develop"))["object"]["sha"]
    tree = gh("api", f"repos/{repo}/git/commits/{base}", "-q", ".tree.sha")
    commit = gh("api", f"repos/{repo}/git/commits", "-f", f"message=Start task: {a.title}",
                "-f", f"tree={tree}", "-f", f"parents[]={base}", "-q", ".sha")
    gh("api", f"repos/{repo}/git/refs", "-f", f"ref=refs/heads/{branch}", "-f", f"sha={commit}")

    body = a.body.strip() + (f"\n\nDue: {a.due}" if a.due else "")
    args = ["pr", "create", "--repo", repo, "--draft", "--base", "develop", "--head", branch,
            "--title", a.title, "--body", body]
    url = gh(*args, "--assignee", owner, check=False)
    if url is None:
        url = gh(*args)
        print(f"Note: could not assign @{owner} (they must accept the repo invitation first). Assign them on the PR page.")
    print(f"Task opened for @{owner}: {url}")
    print(f"To start working:  git fetch && git switch {branch}")


if __name__ == "__main__":
    main()

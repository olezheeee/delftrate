#!/usr/bin/env python3
"""Start-of-session briefing for the DelftRate team.

Coders see: overall progress, the last changes, and their own schedule.
Leads see:  overall progress, the last changes, freshly done PRs, newly created PRs,
            and the schedule of every team member.

Usage:  python3 scripts/start_session.py [--as NAME] [--days N]
Needs:  the GitHub CLI (gh), logged in with `gh auth login`.
"""
import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIELDS = "number,title,author,assignees,isDraft,reviewDecision,createdAt,mergedAt,state,baseRefName,body,url"


def run(*cmd, check=True):
    try:
        r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    except FileNotFoundError:
        sys.exit(f"'{cmd[0]}' is not installed. Install the GitHub CLI from https://cli.github.com and run `gh auth login`.")
    if r.returncode and check:
        sys.exit(f"Command failed: {' '.join(cmd)}\n{r.stderr.strip()}")
    return r.stdout.strip() if r.returncode == 0 else ""


def when(iso):
    return datetime.fromisoformat(iso.replace("Z", "+00:00"))


def ago(iso):
    s = (datetime.now(timezone.utc) - when(iso)).total_seconds()
    if s < 3600:
        return f"{max(1, int(s // 60))} min ago"
    if s < 86400:
        return f"{int(s // 3600)} h ago"
    d = int(s // 86400)
    return "yesterday" if d == 1 else f"{d} days ago"


def due(pr):
    m = re.search(r"^\W*Due\W*?(\d{4}-\d{2}-\d{2})", pr.get("body") or "", re.M | re.I)
    try:
        return date.fromisoformat(m.group(1)) if m else None
    except ValueError:
        return None


def status(pr):
    if pr["isDraft"]:
        return "in progress"
    return {"CHANGES_REQUESTED": "changes requested", "APPROVED": "approved, ready to merge"}.get(
        pr.get("reviewDecision"), "waiting for review")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--as", dest="who", help="show the briefing as another team member (name or GitHub username)")
    ap.add_argument("--days", type=int, default=7, help="how far back 'fresh' goes (default 7)")
    a = ap.parse_args()

    with open(os.path.join(ROOT, ".github", "team.json")) as f:
        members = json.load(f)["members"]
    by_login = {m["github"].lower(): m for m in members if m["github"]}
    name_of = lambda login: by_login.get(login.lower(), {}).get("name", "@" + login)

    login = run("gh", "api", "user", "-q", ".login")
    key = (a.who or login).lower()
    me = by_login.get(key) or next((m for m in members if m["name"].lower() == key), None)
    if me is None:
        me = {"name": "@" + login, "role": "coder", "title": "not in .github/team.json yet", "github": login}
    lead = me["role"] == "lead"
    mine = (me["github"] or "").lower()

    run("git", "fetch", "--quiet", "origin", check=False)
    prs = json.loads(run("gh", "pr", "list", "--state", "all", "--limit", "300", "--json", FIELDS) or "[]")
    tasks = [p for p in prs if p["baseRefName"] != "main"]
    open_ = sorted((p for p in tasks if p["state"] == "OPEN"),
                   key=lambda p: (due(p) or date.max, p["createdAt"]))
    merged = sorted((p for p in tasks if p["state"] == "MERGED"), key=lambda p: p["mergedAt"], reverse=True)
    releases = [p for p in prs if p["baseRefName"] == "main" and p["state"] == "MERGED"]
    since = datetime.now(timezone.utc) - timedelta(days=a.days)
    who = lambda p: ", ".join(name_of(x["login"]) for x in p["assignees"]) or "unassigned"

    def line(p, owner=False):
        d, bits = due(p), [status(p)]
        if d:
            bits.append(f"due {d:%d %b}" + (" (OVERDUE)" if d < date.today() else ""))
        if owner:
            bits.append(who(p))
        return f"  #{p['number']:<4} {p['title']}  [{' · '.join(bits)}]\n        {p['url']}"

    out = []
    say = out.append
    say(f"DELFTRATE · {date.today():%A %d %B %Y}")
    say(f"Signed in as {me['name']} ({me['title']})\n")

    # ---- everyone: overall progress and last changes ----
    say("OVERALL PROGRESS")
    total = len(open_) + len(merged)
    if total:
        pct = round(len(merged) / total * 100)
        bar = "#" * (pct // 5) + "-" * (20 - pct // 5)
        say(f"  [{bar}] {pct}%  ·  {len(merged)} of {total} tasks merged into develop")
        counts = {}
        for p in open_:
            counts[status(p)] = counts.get(status(p), 0) + 1
        say("  Open: " + (", ".join(f"{n} {s}" for s, n in counts.items()) or "none"))
    else:
        say("  No tasks yet. A lead can hand out the first one with scripts/new_task.py.")
    ahead = run("git", "rev-list", "--count", "origin/main..origin/develop", check=False)
    say(f"  Releases to main: {len(releases)}" + (f"  ·  develop is {ahead} commits ahead of main" if ahead else ""))

    say("\nLAST CHANGES")
    if merged:
        for p in merged[:5]:
            say(f"  #{p['number']:<4} {p['title']}  ({who(p)}, merged {ago(p['mergedAt'])})")
    else:
        log = run("git", "log", "origin/develop", "-5", "--pretty=format:  %h  %s  (%an, %cr)", check=False)
        say(log or "  Nothing merged yet.")

    if lead:
        # ---- leads: fresh work, new PRs, everyone's schedule ----
        fresh = [p for p in merged if when(p["mergedAt"]) >= since]
        ready = [p for p in open_ if not p["isDraft"]]
        say(f"\nFRESHLY DONE (merged in the last {a.days} days)")
        say("\n".join(line(p, True).replace(status(p), "merged " + ago(p["mergedAt"])) for p in fresh) or "  Nothing.")
        say("\nREADY FOR REVIEW")
        say("\n".join(line(p, True) for p in ready) or "  Nothing is waiting.")
        say(f"\nNEWLY CREATED (opened in the last {a.days} days)")
        new = [p for p in open_ if when(p["createdAt"]) >= since]
        say("\n".join(f"{line(p, True)}\n        opened {ago(p['createdAt'])} by {name_of(p['author']['login'])}" for p in new) or "  Nothing.")
        say("\nTEAM SCHEDULE")
        for m in members:
            say(f" {m['name']} · {m['title']}")
            if not m["github"]:
                say("    (no GitHub username in .github/team.json yet)")
                continue
            own = [p for p in open_ if any(x["login"].lower() == m["github"].lower() for x in p["assignees"])]
            say("\n".join("  " + line(p).replace("\n", "\n  ") for p in own) or "    Nothing assigned.")
        loose = [p for p in open_ if not p["assignees"]]
        if loose:
            say(" Unassigned")
            say("\n".join("  " + line(p).replace("\n", "\n  ") for p in loose))
    else:
        # ---- coders: their own schedule ----
        own = [p for p in open_ if any(x["login"].lower() == mine for x in p["assignees"])]
        say("\nYOUR SCHEDULE")
        if own:
            order = {"changes requested": 0, "in progress": 1, "waiting for review": 2, "approved, ready to merge": 3}
            for p in sorted(own, key=lambda p: (order[status(p)], due(p) or date.max)):
                say(line(p))
            say("\n  Order: fix requested changes first, then tasks in progress by due date.")
        else:
            say("  Nothing is assigned to you. Ask a lead, or open your own PR with scripts/new_task.py.")
        done = [p for p in merged if any(x["login"].lower() == mine for x in p["assignees"])]
        if done:
            say(f"\n  You have {len(done)} merged {'task' if len(done) == 1 else 'tasks'} so far.")

    print("\n".join(out))


if __name__ == "__main__":
    main()

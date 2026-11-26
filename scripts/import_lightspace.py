#!/usr/bin/env python3
"""Rebuild the resource lists in content/resources/ from Lightspace.

Lightspace (https://lightspace.study) is a student-run open archive of the TU Delft
Computer Science and Engineering bachelor: lectures, past exams, solutions and notes per
course. This script reads its course pages and writes, for every course that has a CSE
course code, the list of what the archive holds:

    content/resources/<CODE>/resources.json

Only titles and links are taken. No file is downloaded and nothing of the material itself
is copied into this repository. Textbooks are listed by title, without a link.
The site's robots.txt allows reading its pages, except /api/; this script stays out of /api/.

Usage:
    python3 scripts/import_lightspace.py            # every course
    python3 scripts/import_lightspace.py CSE21C     # one course

The two booklets next to each resource list (knowledge.json, exams.json) are written
separately and are not touched here. Run `npm test` afterwards: one test checks every file
in content/resources/.
"""
import datetime
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

SITE = "https://lightspace.study"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "content", "resources")
# A plain client name: no project or personal details go to another site.
USER_AGENT = "Mozilla/5.0 (compatible; course-resources-import)"

# The archive's own group names, and the kind each one becomes here.
KINDS = {
    "Lectures": "lectures",
    "Exams": "exams",
    "Solutions": "solutions",
    "Notes": "notes",
    "Textbooks": "textbooks",
}


def fetch(url):
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read().decode("utf-8", "replace")


def text(fragment):
    """The visible text of a piece of HTML."""
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", "", fragment))).strip()


def course_slugs():
    sitemap = fetch(f"{SITE}/sitemap.xml")
    return [m for m in re.findall(r"<loc>%s/courses/([^<]+)</loc>" % re.escape(SITE), sitemap)]


def parse_course(slug, page):
    """Returns (code, resources) for a core course, or None for a page without a CSE code."""
    folder = re.search(r'/api/download\?folder=([^"]+)"', page)
    code = re.search(r"CSE (\w+) ", urllib.parse.unquote(folder.group(1))) if folder else None
    if not code:
        return None
    title = re.search(r"<h1[^>]*>(.*?)</h1>", page, flags=re.S)

    groups = []
    # The page is a row of cards. Each card has a title and a body.
    cards = re.split(r'<div data-slot="card"[^>]*>', page)[1:]
    for card in cards:
        head = re.search(r'<div data-slot="card-title"[^>]*>(.*?)</div>', card, flags=re.S)
        if not head:
            continue
        name = text(re.sub(r"<svg.*?</svg>", "", re.sub(r"<span.*?</span>", "", head.group(1), flags=re.S), flags=re.S))

        if name in KINDS:
            items = []
            # One item: <div title="path"><a href="/courses/<slug>/read/...">Title</a><span>Label</span><span>Size</span>
            for href, label, spans in re.findall(
                r'<a\b[^>]*\bhref="(/courses/%s/read/[^"]+)"[^>]*>(.*?)</a>((?:<span[^>]*>.*?</span>)*)' % re.escape(slug),
                card,
                flags=re.S,
            ):
                notes = [text(s) for s in re.findall(r"<span[^>]*>(.*?)</span>", spans, flags=re.S)]
                size = notes.pop() if notes and re.fullmatch(r"[\d.]+ ?[KMG]?B", notes[-1]) else None
                item = {"title": text(label)}
                # Where in the archive it sits, for example "Endterms" or "From IDM / Resits".
                if notes:
                    item["section"] = notes[0]
                if KINDS[name] != "textbooks":
                    item["url"] = SITE + html.unescape(href)
                    if size:
                        item["size"] = size
                items.append(item)
            if items:
                groups.append({"kind": KINDS[name], "items": items})

        elif name == "Resources":
            # Links to other sites that the archive recommends: videos, tools, reference pages.
            items = []
            for href, label in re.findall(r'<a\b[^>]*\bhref="(https?://[^"]+)"[^>]*>(.*?)</a>', card, flags=re.S):
                link = html.unescape(href)
                if link.startswith(SITE) or any(i["url"] == link for i in items):
                    continue
                items.append({"title": text(label), "url": link})
            if items:
                groups.append({"kind": "links", "items": items})

    return code.group(0).replace(" ", ""), {
        "course": code.group(0).replace(" ", ""),
        "source": {
            "name": "Lightspace",
            "title": text(title.group(1)) if title else slug,
            "url": f"{SITE}/courses/{slug}",
            "retrieved": datetime.date.today().isoformat(),
        },
        "groups": groups,
    }


def main():
    only = {a.upper() for a in sys.argv[1:]}
    written = []
    for slug in course_slugs():
        parsed = parse_course(slug, fetch(f"{SITE}/courses/{slug}"))
        time.sleep(0.5)  # be a polite visitor
        if not parsed:
            continue
        code, resources = parsed
        if only and code not in only:
            continue
        if not resources["groups"]:
            print(f"{code}: the archive has no material yet, nothing written")
            continue
        folder = os.path.join(OUT, code)
        os.makedirs(folder, exist_ok=True)
        with open(os.path.join(folder, "resources.json"), "w", encoding="utf-8") as f:
            json.dump(resources, f, indent=2, ensure_ascii=False)
            f.write("\n")
        count = sum(len(g["items"]) for g in resources["groups"])
        written.append(code)
        print(f"{code}: {count} items in {len(resources['groups'])} groups")
    missing = only - set(written)
    if missing:
        sys.exit(f"Not found or without material: {', '.join(sorted(missing))}")
    print(f"Wrote {len(written)} resource lists to content/resources/")


if __name__ == "__main__":
    main()

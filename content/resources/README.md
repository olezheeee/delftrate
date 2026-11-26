# Course resources and booklets

One folder per course, named by the course code as the database spells it (`CSE21C`).
The course card shows what is in it under "Resources". A course without a folder, or with
only some of the files, simply shows less.

| File | What it is | Made by |
| --- | --- | --- |
| `resources.json` | The study material of the course, as titles and links | `scripts/import_lightspace.py` |
| `knowledge.json` | Booklet 1, "What to know": topics, lecture time, importance | written per course |
| `exams.json` | Booklet 2, "The exam": what the past papers show | written per course |

The format of all three is defined and checked in `lib/resources.ts`. A file that does
not pass is not shown, and `content/resources/content.test.ts` (part of `npm test`) fails.

## Where it comes from

The material is collected by [Lightspace](https://lightspace.study), a student-run archive
of the TU Delft Computer Science and Engineering bachelor. It is not an official TU Delft
source, and we say so wherever we show it.

## Rules (keep these when you add or change a file)

- **Links only.** Nothing from the archive is copied into this repository: no slides, no
  papers, no solutions, no descriptions. `resources.json` holds titles and links that open
  on the archive's own site.
- **Books by title only.** A textbook is listed without a link (the check refuses one).
- **Booklets in our own words.** A booklet names concepts and describes kinds of questions.
  It never repeats a slide, an exam question or a model answer.
- **Only what was counted.** Every share, number of questions, points and minutes comes
  from the material. `basis` says what a booklet rests on and where it had to estimate.
  A course without past papers has `available: false` and no numbers.
- **Plain text.** No Markdown, LaTeX or links in a booklet: the page shows the text as it is.
- The two booklets come as a pair, carry the same `title`, and the exam booklet weighs the
  topics of the knowledge booklet (or `Other`).

## How the numbers are made

- **Lecture time** of a topic: its share of the lecture slides that carry content
  (lectures are counted where the slides are not available as text).
- **Exam points** of a topic: its share of the points over the papers listed in
  `basis.papers` of `exams.json` (at most the six most recent complete papers).
- **Suggested study time**: the course's hours (28 per EC) divided over the topics by the
  mean of the two shares, in whole hours that add up to the course. Exam points filed
  under "Other" belong to no topic and are left out of the division. Not shown for a
  course without past papers (the projects): there lecture time
  says how the taught sessions are divided, not where the hours go. Worked out by
  `topicStatistics` in `lib/resources.ts`, not stored.

## Refreshing

```
python3 scripts/import_lightspace.py            # every course
python3 scripts/import_lightspace.py CSE21C     # one course
npx vitest run content                          # check everything
npx vitest run content -t CSE21C                # check one course
```

The import only rewrites `resources.json`. It reads the public course pages, keeps to the
site's `robots.txt` and waits between requests. Courses the archive files under another
programme, the electives, and courses it holds nothing for are not imported.

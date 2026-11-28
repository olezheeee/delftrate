# Course data

One JSON file per programme: `AE.json` (Sahil) and `CSE.json` (Oleg). Only edit
your own file, so our changes never collide.

## Where the data comes from

The lists are compiled **by hand**, from the public study guide
(https://studiegids.tudelft.nl) or from an export the programme gives us. Do not
scrape the site or use a script or bot to collect it. TU Delft's site
disclaimer says its texts "may not be copied or changed or used in any other
way, without written permission in advance", and nothing there explicitly
allows automated collection.

## File format

```json
{
  "programme": "AE",
  "academicYear": "2026-2027",
  "courses": [
    {
      "code": "AE1101",
      "name": "Introduction to Aerospace Engineering I",
      "year": 1,
      "quarters": [1, 2],
      "professors": ["Dr. Jane Doe", "Prof. John Smith"]
    }
  ]
}
```

(That course is only an example.) The rules:

- `programme`: `AE` or `CSE`, and it must match the file name.
- `academicYear`: like `2026-2027`; the second year is the first plus one. Both
  files must say the same year.
- `code`: uppercase letters, digits and hyphens only. `ae1101` is an error.
  Each code may appear once across all files.
- `name`: not empty. Extra spaces are cleaned up for you.
- `year`: 1, 2 or 3 (bachelor year).
- `quarters`: at least one of 1, 2, 3, 4, no repeats; the quarters the home-page calendar shows the course in.
- `professors`: at least one name, no repeats within a course.
- No other keys. A typo such as `profesors` is reported as an error.

## Writing professors

Write the full name as the study guide shows it, and write the same person the
same way in every course (same title, same initials, same spelling). The
loader matches professors on the exact name, so "Dr. Jane Doe" and "J. Doe"
become two different people. Two spellings that differ only in capitals
("Dr. Jane Doe" and "Dr. Jane doe") are reported as an error.

## Checking your file

Run `npm test`. One test reads the real files in this folder and fails with a
message naming the file and course (for example
`AE.json, course #3 (AE1101): year must be 1, 2 or 3`). Fix every message and
run it again.

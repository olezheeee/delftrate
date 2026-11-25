import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadCourseFiles, validateCourseFiles } from "./schema";

function course(overrides: Record<string, unknown> = {}) {
  return {
    code: "AE1101",
    name: "Introduction to Aerospace Engineering I",
    year: 1,
    quarters: [1, 2],
    professors: ["Dr. Jane Doe"],
    ...overrides,
  };
}

function file(courses: unknown[], overrides: Record<string, unknown> = {}) {
  return { programme: "AE", academicYear: "2026-2027", courses, ...overrides };
}

function check(data: unknown, label = "AE.json") {
  return validateCourseFiles([{ label, data }]);
}

describe("validateCourseFiles", () => {
  it("accepts a valid file and normalises it", () => {
    const result = check(
      file([
        course({
          name: "  Intro   to \t Aerospace ",
          quarters: [3, 1, 2],
          professors: ["  Dr.  Jane   Doe ", "Prof. John Smith"],
        }),
      ]),
    );
    expect(result.errors).toEqual([]);
    expect(result.courses).toEqual([
      {
        code: "AE1101",
        name: "Intro to Aerospace",
        programme: "AE",
        year: 1,
        quarters: [1, 2, 3],
        professors: ["Dr. Jane Doe", "Prof. John Smith"],
      },
    ]);
  });

  it("accepts an empty courses array", () => {
    expect(check(file([]))).toEqual({ courses: [], errors: [] });
  });

  it("rejects a non-object file", () => {
    expect(check([]).errors[0]).toMatch(/AE\.json: file must contain a JSON object/);
  });

  it("rejects an unknown programme", () => {
    const { errors } = check(file([], { programme: "XX" }), "XX.json");
    expect(errors.join("\n")).toMatch(/programme must be one of AE, CSE/);
  });

  it("rejects a programme that does not match the file name", () => {
    const { errors } = check(file([], { programme: "CSE" }), "AE.json");
    expect(errors.join("\n")).toMatch(/does not match the file name/);
  });

  it("rejects a bad academicYear", () => {
    for (const bad of ["2026-2028", "2026", "26-27", 2026, undefined]) {
      const { errors } = check(file([], { academicYear: bad }));
      expect(errors.join("\n")).toMatch(/academicYear must look like 2026-2027/);
    }
  });

  it("rejects courses that is not an array", () => {
    expect(check(file([], { courses: {} })).errors.join()).toMatch(
      /courses must be an array/,
    );
  });

  it("reports unknown keys on the file and on a course", () => {
    const { errors } = check(
      file([course({ profesors: ["x"] })], { extra: 1 }),
    );
    expect(errors.join("\n")).toMatch(/AE\.json: unknown key "extra"/);
    expect(errors.join("\n")).toMatch(
      /AE\.json, course #1 \(AE1101\): unknown key "profesors"/,
    );
  });

  it("rejects bad codes without uppercasing them", () => {
    for (const bad of ["ae1101", "", "   ", "AE 1101", "-AE1", 5, undefined]) {
      const result = check(file([course({ code: bad })]));
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.courses).toEqual([]);
    }
    expect(check(file([course({ code: "ae1101" })])).errors[0]).toBe(
      "AE.json, course #1 (ae1101): code must use only uppercase letters, digits and hyphens",
    );
  });

  it("accepts codes with hyphens and digits first", () => {
    expect(check(file([course({ code: "2-AE-1" })])).errors).toEqual([]);
  });

  it("rejects an empty name", () => {
    for (const bad of ["", "   ", 3, undefined]) {
      expect(check(file([course({ name: bad })])).errors.join()).toMatch(
        /name must be a non-empty string/,
      );
    }
  });

  it("rejects years outside 1-3 with the course in the message", () => {
    for (const bad of [0, 4, 1.5, "1", undefined]) {
      const { errors } = check(file([course(), course({ code: "AE2", year: bad })]));
      expect(errors).toEqual([
        "AE.json, course #2 (AE2): year must be 1, 2 or 3",
      ]);
    }
  });

  it("rejects bad quarters", () => {
    const cases: [unknown, RegExp][] = [
      [[], /quarters must be a non-empty array/],
      ["1", /quarters must be a non-empty array/],
      [[0], /integers 1, 2, 3 or 4/],
      [[5], /integers 1, 2, 3 or 4/],
      [[1.5], /integers 1, 2, 3 or 4/],
      [["1"], /integers 1, 2, 3 or 4/],
      [[1, 1], /duplicates/],
    ];
    for (const [bad, pattern] of cases) {
      expect(check(file([course({ quarters: bad })])).errors.join()).toMatch(
        pattern,
      );
    }
  });

  it("rejects bad professors", () => {
    expect(check(file([course({ professors: [] })])).errors.join()).toMatch(
      /professors must be a non-empty array/,
    );
    expect(check(file([course({ professors: ["A", " "] })])).errors.join()).toMatch(
      /professors\[1\] must be a non-empty string/,
    );
    expect(check(file([course({ professors: [3] })])).errors.join()).toMatch(
      /professors\[0\]/,
    );
  });

  it("rejects duplicate professors after normalising", () => {
    const { errors } = check(
      file([course({ professors: ["Dr. Jane Doe", "Dr.  Jane  Doe"] })]),
    );
    expect(errors.join()).toMatch(/professor "Dr\. Jane Doe" is listed more than once/);
  });

  it("collects all errors, and keeps only valid courses", () => {
    const result = check(
      file([course({ year: 9 }), course({ code: "AE2", quarters: [] }), course({ code: "AE3" })]),
    );
    expect(result.errors).toHaveLength(2);
    expect(result.courses.map((c) => c.code)).toEqual(["AE3"]);
  });

  it("falls back to the index when a course has no code", () => {
    const { errors } = check(file([course({ code: undefined })]));
    expect(errors[0]).toMatch(/^AE\.json, course #1: code must be a string/);
  });

  it("reports a non-object course", () => {
    expect(check(file(["x"])).errors).toEqual([
      "AE.json, course #1: must be an object",
    ]);
  });

  it("reports a duplicate code across files, naming both places", () => {
    const result = validateCourseFiles([
      { label: "AE.json", data: file([course({ code: "X100" })]) },
      {
        label: "CSE.json",
        data: file([course({ code: "X100" })], { programme: "CSE" }),
      },
    ]);
    expect(result.errors).toEqual([
      "CSE.json, course #1 (X100): code already used by AE.json, course #1; a course code may appear only once",
    ]);
    expect(result.courses).toEqual([]);
  });

  it("reports a duplicate code within one file", () => {
    const { errors } = check(file([course(), course()]));
    expect(errors.join()).toMatch(/course #2 \(AE1101\): code already used by AE\.json, course #1/);
  });
});

describe("checks across courses and files", () => {
  it("treats the composed and decomposed forms of an accented name as one professor", () => {
    const composed = "Dr. Seán O'Neill";
    const decomposed = "Dr. Seán O'Neill";
    const result = check(
      file([
        course({ code: "AE1101", professors: [composed] }),
        course({ code: "AE1102", professors: [decomposed] }),
      ]),
    );
    expect(result.errors).toEqual([]);
    expect(result.courses.map((c) => c.professors[0])).toEqual([composed, composed]);
  });

  it("reports a professor name that differs only in capitals, across files", () => {
    const result = validateCourseFiles([
      { label: "AE.json", data: file([course({ professors: ["Dr. Jane Doe"] })]) },
      {
        label: "CSE.json",
        data: file([course({ code: "CSE1100", professors: ["Dr. Jane doe"] })], { programme: "CSE" }),
      },
    ]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatch(/CSE\.json, course #1 \(CSE1100\).*"Dr\. Jane doe".*"Dr\. Jane Doe".*AE\.json/);
  });

  it("reports files for different academic years", () => {
    const result = validateCourseFiles([
      { label: "AE.json", data: file([]) },
      { label: "CSE.json", data: file([], { programme: "CSE", academicYear: "2027-2028" }) },
    ]);
    expect(result.errors).toEqual([
      "CSE.json: academicYear is 2027-2028 but AE.json says 2026-2027; every file must be for the same academic year",
    ]);
  });
});

describe("loadCourseFiles", () => {
  it("reads a file whose extension is in capitals instead of skipping it", () => {
    const dir = mkdtempSync(join(tmpdir(), "courses-"));
    try {
      writeFileSync(join(dir, "AE.JSON"), JSON.stringify(file([course()])));
      writeFileSync(join(dir, "CSE.json"), JSON.stringify(file([], { programme: "CSE" })));
      const result = loadCourseFiles(dir);
      expect(result.errors).toEqual([]);
      expect(result.courses).toHaveLength(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports a programme whose file is missing", () => {
    const dir = mkdtempSync(join(tmpdir(), "courses-"));
    try {
      writeFileSync(join(dir, "AE.json"), JSON.stringify(file([course()])));
      const result = loadCourseFiles(dir);
      expect(result.errors).toEqual(["CSE.json: file is missing"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("accepts the real data files", () => {
    const result = loadCourseFiles();
    expect(result.errors).toEqual([]);
  });

  it("reports invalid JSON instead of throwing", () => {
    const dir = mkdtempSync(join(tmpdir(), "courses-"));
    try {
      writeFileSync(join(dir, "AE.json"), "{ not json");
      writeFileSync(
        join(dir, "CSE.json"),
        JSON.stringify(file([], { programme: "CSE" })),
      );
      const result = loadCourseFiles(dir);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toMatch(/^AE\.json: could not be read as JSON/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

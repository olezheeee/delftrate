import { describe, expect, it } from "vitest";
import { courseHref, layoutCalendar, moduleCode, parseChoice, type CalendarCourse } from "./calendar";
import { safeNextPath } from "./auth/routes";

function course(code: string, quarters: number[]): CalendarCourse {
  return { code, name: code, programme: "AE", year: 1, quarters };
}

// Each block as "code row/column span x height", which is easy to read in a failure.
function shape(courses: CalendarCourse[]) {
  const layout = layoutCalendar(courses);
  return {
    rows: layout.rows,
    blocks: layout.blocks.map((b) => `${b.item.code} ${b.row}/${b.column} ${b.span}x${b.height}`),
  };
}

describe("the choice of programme and year", () => {
  it("accepts the programmes and years the calendar offers", () => {
    expect(parseChoice({ programme: "CSE", year: "2" })).toEqual({ programme: "CSE", year: 2 });
    expect(parseChoice({ programme: "AE", year: 3 })).toEqual({ programme: "AE", year: 3 });
  });

  it("drops anything else", () => {
    expect(parseChoice({ programme: "LAW", year: "1" })).toEqual({ programme: null, year: null });
    expect(parseChoice({ programme: "AE", year: "4" })).toEqual({ programme: "AE", year: null });
    expect(parseChoice({ programme: ["AE"], year: "1.0" })).toEqual({ programme: null, year: null });
    expect(parseChoice({})).toEqual({ programme: null, year: null });
  });

  it("does not keep a year without a programme", () => {
    expect(parseChoice({ year: "2" })).toEqual({ programme: null, year: null });
  });
});

describe("the layout of the calendar", () => {
  it("puts each course under its quarter and stacks courses of the same quarter", () => {
    expect(shape([course("A", [1]), course("B", [1]), course("C", [2]), course("D", [4])])).toEqual({
      rows: 2,
      // C and D have their quarter to themselves, so they fill both rows.
      blocks: ["A 0/0 1x1", "B 1/0 1x1", "C 0/1 1x2", "D 0/3 1x2"],
    });
  });

  it("lets a course that runs over several quarters span them", () => {
    expect(shape([course("LONG", [3, 4]), course("SHORT", [3])])).toEqual({
      rows: 2,
      blocks: ["LONG 0/2 2x1", "SHORT 1/2 1x1"],
    });
  });

  it("draws a course with a gap in its quarters as one stretch", () => {
    expect(shape([course("GAP", [1, 3])]).blocks).toEqual(["GAP 0/0 3x1"]);
  });

  it("leaves out a course without quarters", () => {
    expect(shape([course("NONE", []), course("A", [2])])).toEqual({ rows: 1, blocks: ["A 0/1 1x1"] });
    expect(layoutCalendar([])).toEqual({ rows: 0, blocks: [] });
  });

  it("draws the courses of one module together", () => {
    const layout = layoutCalendar([
      course("AE2130-I", [1]),
      course("AE2130-II", [2]),
      course("AE2130-III", [2]),
      course("AE1241", [3, 4]),
    ]);
    expect(layout.blocks.map((b) => `${b.item.code} ${b.row}/${b.column} ${b.span}x${b.height}`)).toEqual([
      "AE2130 0/0 2x1",
      "AE1241 0/2 2x1",
    ]);
    const [module, single] = layout.blocks.map((b) => b.item);
    expect(module.isModule).toBe(true);
    // Inside the module the columns start at its own first quarter. Aerodynamics I has
    // quarter 1 to itself and fills both rows.
    expect(module.courses.map((c) => `${c.item.code} ${c.row}/${c.column} ${c.span}x${c.height}`)).toEqual([
      "AE2130-I 0/0 1x2",
      "AE2130-II 0/1 1x1",
      "AE2130-III 1/1 1x1",
    ]);
    expect(single.isModule).toBe(false);
    expect(single.courses).toHaveLength(1);
  });

  it("only groups on a Roman numeral, and never a course on its own", () => {
    expect(moduleCode("AE1110-II")).toBe("AE1110");
    expect(moduleCode("WI2180-I")).toBe("WI2180");
    expect(moduleCode("TW-E99")).toBe("TW-E99");
    expect(shape([course("AE3200-I", [4])]).blocks).toEqual(["AE3200-I 0/3 1x1"]);
  });

  it("never lets two blocks share a cell", () => {
    const courses = [
      course("A-I", [1]), course("A-II", [2]), course("B", [2, 3]), course("C", [1, 2]),
      course("D", [3]), course("E", [4]), course("F", [1, 4]), course("G", [3, 4]),
    ];
    const layout = layoutCalendar(courses);
    const cells = new Set<string>();
    for (const b of layout.blocks) {
      for (let row = b.row; row < b.row + b.height; row++) {
        for (let column = b.column; column < b.column + b.span; column++) {
          const cell = `${row}/${column}`;
          expect(cells.has(cell), `${b.item.code} at ${cell}`).toBe(false);
          cells.add(cell);
          expect(row).toBeLessThan(layout.rows);
          expect(column).toBeLessThan(4);
        }
      }
    }
  });
});

describe("the link of a course", () => {
  it("opens the course sheet for a signed-in user", () => {
    expect(courseHref("AE1110-I", true)).toBe("/courses/AE1110-I");
  });

  it("sends a signed-out visitor through login and back to the course", () => {
    const href = courseHref("AE1110-I", false);
    expect(href).toBe("/login?next=%2Fcourses%2FAE1110-I");
    // The login form accepts that page as the place to return to.
    expect(safeNextPath(new URL(href, "http://localhost").searchParams.get("next"))).toBe("/courses/AE1110-I");
  });
});

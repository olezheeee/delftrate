import { describe, expect, it } from "vitest";
import { layoutCalendar, parseChoice, type CalendarCourse } from "./calendar";

const c = (
  code: string,
  quarters: number[],
  programme = "CSE",
  year = 1,
): CalendarCourse => ({ code, name: code, programme, year, quarters });

describe("layoutCalendar", () => {
  it("spans adjacent quarters in one rectangle", () => {
    const l = layoutCalendar([c("A", [2, 3, 4])], "CSE", 1);
    expect(l.placements).toHaveLength(1);
    expect(l.placements[0]).toMatchObject({ start: 2, span: 3, lane: 0 });
    expect(l.lanes).toBe(1);
  });

  it("gives one rectangle per run for non-adjacent quarters", () => {
    const l = layoutCalendar([c("A", [1, 3])], "CSE", 1);
    expect(l.placements.map((p) => [p.start, p.span])).toEqual([
      [1, 1],
      [3, 1],
    ]);
  });

  it("fills a gap inside a lane instead of opening a new one", () => {
    // A runs in Q1 and Q3, which leaves Q2 free in lane 0 for B.
    const l = layoutCalendar(
      [
        { code: "A", name: "A", programme: "CSE", year: 1, quarters: [1, 3] },
        { code: "B", name: "B", programme: "CSE", year: 1, quarters: [2] },
      ],
      "CSE",
      1,
    );
    expect(l.placements.map((p) => [p.course.code, p.start, p.lane])).toEqual([
      ["A", 1, 0],
      ["A", 3, 0],
      ["B", 2, 0],
    ]);
    expect(l.lanes).toBe(1);
  });

  it("puts overlapping courses in separate lanes and reuses free lanes", () => {
    const l = layoutCalendar(
      [c("A", [1, 2]), c("B", [2]), c("C", [3])],
      "CSE",
      1,
    );
    const lane = (code: string) =>
      l.placements.find((p) => p.course.code === code)!.lane;
    expect(lane("A")).toBe(0);
    expect(lane("B")).toBe(1);
    expect(lane("C")).toBe(0);
    expect(l.lanes).toBe(2);
  });

  it("filters by programme and year", () => {
    const l = layoutCalendar(
      [c("A", [1]), c("B", [1], "AE"), c("D", [1], "CSE", 2)],
      "CSE",
      1,
    );
    expect(l.placements.map((p) => p.course.code)).toEqual(["A"]);
  });

  it("counts courses without quarters as unplaced", () => {
    const l = layoutCalendar([c("A", []), c("B", [1])], "CSE", 1);
    expect(l.unplaced).toBe(1);
    expect(l.placements).toHaveLength(1);
  });

  it("is deterministic: first quarter, then code", () => {
    const input = [c("Z", [1]), c("B", [2]), c("A", [1])];
    const a = layoutCalendar(input, "CSE", 1);
    const b = layoutCalendar([...input].reverse(), "CSE", 1);
    expect(a.placements.map((p) => p.course.code)).toEqual(["A", "Z", "B"]);
    expect(b).toEqual(a);
  });

  it("returns an empty layout when nothing matches", () => {
    expect(layoutCalendar([], "AE", 3)).toEqual({
      placements: [],
      lanes: 0,
      unplaced: 0,
    });
  });
});

describe("parseChoice", () => {
  it("accepts valid values", () => {
    expect(parseChoice(new URLSearchParams("programme=CSE&year=2"))).toEqual({
      programme: "CSE",
      year: 2,
    });
    expect(parseChoice({ programme: "AE", year: "3" })).toEqual({
      programme: "AE",
      year: 3,
    });
  });

  it("rejects invalid or missing values", () => {
    expect(parseChoice(new URLSearchParams("programme=cse&year=4"))).toEqual({
      programme: null,
      year: null,
    });
    expect(parseChoice({ year: "x" })).toEqual({ programme: null, year: null });
    expect(parseChoice({})).toEqual({ programme: null, year: null });
  });

  it("uses the first value of repeated params", () => {
    expect(parseChoice({ programme: ["AE", "CSE"] }).programme).toBe("AE");
  });
});

import { describe, expect, it } from "vitest";
import { totalsText } from "./site-totals";

describe("totalsText", () => {
  it("lists votes, students and courses in that order", () => {
    expect(totalsText({ votes: 74, students: 12, courses: 65 })).toEqual([
      { key: "votes", count: "74", label: "votes" },
      { key: "students", count: "12", label: "students" },
      { key: "courses", count: "65", label: "courses" },
    ]);
  });

  it("groups thousands", () => {
    expect(totalsText({ votes: 12480, students: 1240, courses: 999 }).map((item) => item.count)).toEqual([
      "12,480",
      "1,240",
      "999",
    ]);
  });

  it("says one vote, one student and one course, and zero votes", () => {
    expect(totalsText({ votes: 1, students: 1, courses: 1 }).map((item) => item.label)).toEqual([
      "vote",
      "student",
      "course",
    ]);
    expect(totalsText({ votes: 0, students: 0, courses: 0 }).map((item) => `${item.count} ${item.label}`)).toEqual([
      "0 votes",
      "0 students",
      "0 courses",
    ]);
  });
});

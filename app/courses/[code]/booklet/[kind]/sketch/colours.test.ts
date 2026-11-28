import { describe, expect, it } from "vitest";
import { GREY, PENCILS, pencil } from "./colours";

describe("the pencils of the hand-drawn diagrams", () => {
  it("gives the first seven things a colour of their own, in a fixed order", () => {
    const colours = PENCILS.map((_, index) => pencil(index));
    expect(colours.map((one) => one.colour)).toEqual([...PENCILS]);
    expect(colours.every((one) => !one.crossed)).toBe(true);
    expect(new Set(PENCILS).size).toBe(PENCILS.length);
  });

  it("tells the eighth and later apart by cross-hatching", () => {
    expect(pencil(7)).toEqual({ colour: PENCILS[0], crossed: true });
    expect(pencil(8)).toEqual({ colour: PENCILS[1], crossed: true });
    // Colour and hatching together are unique up to twice the number of pencils.
    const seen = new Set(Array.from({ length: PENCILS.length * 2 }, (_, index) => JSON.stringify(pencil(index))));
    expect(seen.size).toBe(PENCILS.length * 2);
  });

  it("keeps grey out of the topic colours and violet out of all of them", () => {
    expect(PENCILS).not.toContain(GREY.colour);
    for (const colour of PENCILS) {
      const [r, g, b] = [1, 3, 5].map((at) => parseInt(colour.slice(at, at + 2), 16));
      // Violet: blue and red both well above green, blue leading.
      expect(b > g + 40 && r > g + 40 && b >= r).toBe(false);
    }
  });
});

import { describe, expect, it } from "vitest";
import { arc, hatch, line, onCircle, outline, seedOf, seeded, shares, slice, type Point } from "./sketch";

// Every coordinate of a path, as pairs.
function points(path: string): Point[] {
  const numbers = (path.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
  const pairs: Point[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) pairs.push([numbers[index], numbers[index + 1]]);
  return pairs;
}

const SQUARE: Point[] = [
  [10, 10],
  [110, 10],
  [110, 110],
  [10, 110],
];

describe("seeds", () => {
  it("gives the same numbers for the same seed, between 0 and 1", () => {
    const first = seeded(42);
    const second = seeded(42);
    const values = Array.from({ length: 200 }, () => first());
    expect(values).toEqual(Array.from({ length: 200 }, () => second()));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
  });

  it("gives other numbers for another seed", () => {
    expect(seeded(1)()).not.toBe(seeded(2)());
  });

  it("makes a seed from a text, the same each time", () => {
    expect(seedOf("Calculus")).toBe(seedOf("Calculus"));
    expect(seedOf("Calculus")).not.toBe(seedOf("Algebra"));
    expect(Number.isInteger(seedOf(""))).toBe(true);
  });
});

describe("lines", () => {
  it("draws the same line for the same seed and another for another seed", () => {
    expect(line([0, 0], [200, 0], { seed: 7 })).toBe(line([0, 0], [200, 0], { seed: 7 }));
    expect(line([0, 0], [200, 0], { seed: 7 })).not.toBe(line([0, 0], [200, 0], { seed: 8 }));
  });

  it("goes over the line as often as asked", () => {
    expect(line([0, 0], [200, 0], { seed: 7, passes: 1 }).match(/M/g)).toHaveLength(1);
    expect(line([0, 0], [200, 0], { seed: 7 }).match(/M/g)).toHaveLength(2);
    expect(line([0, 0], [200, 0], { seed: 7, passes: 3 }).match(/M/g)).toHaveLength(3);
  });

  it("stays close to the straight line", () => {
    for (const [x, y] of points(line([0, 50], [200, 50], { seed: 3, rough: 1.5 }))) {
      expect(x).toBeGreaterThan(-3);
      expect(x).toBeLessThan(203);
      expect(Math.abs(y - 50)).toBeLessThan(5);
    }
  });

  it("does not break on a line without length", () => {
    expect(line([5, 5], [5, 5], { seed: 1 })).not.toContain("NaN");
  });

  it("draws one line per side of a shape", () => {
    expect(outline(SQUARE, { seed: 1, passes: 1 }).match(/M/g)).toHaveLength(4);
  });
});

describe("circles", () => {
  it("counts turns clockwise from 12 o'clock", () => {
    const [topX, topY] = onCircle([100, 100], 50, 0);
    expect(topX).toBeCloseTo(100);
    expect(topY).toBeCloseTo(50);
    const [rightX, rightY] = onCircle([100, 100], 50, 0.25);
    expect(rightX).toBeCloseTo(150);
    expect(rightY).toBeCloseTo(100);
    const [bottomX, bottomY] = onCircle([100, 100], 50, 0.5);
    expect(bottomX).toBeCloseTo(100);
    expect(bottomY).toBeCloseTo(150);
  });

  it("keeps a drawn circle near its radius", () => {
    const path = arc([100, 100], 50, 0, 1, { seed: 9, rough: 1 });
    expect(path).not.toContain("NaN");
    // The points the curve goes through are the last pair of every "C" and the "M".
    const through = [...path.matchAll(/(?:M|C[^CM]*? )(-?[\d.]+) (-?[\d.]+)(?=C|M|$)/g)].map(
      (match): Point => [Number(match[1]), Number(match[2])],
    );
    expect(through.length).toBeGreaterThan(20);
    for (const [x, y] of through) expect(Math.abs(Math.hypot(x - 100, y - 100) - 50)).toBeLessThan(2);
  });

  it("starts a slice at the centre, and a whole circle not", () => {
    expect(slice([100, 100], 50, 0, 0.25)[0]).toEqual([100, 100]);
    const whole = slice([100, 100], 50, 0, 1);
    for (const [x, y] of whole) expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(50);
  });
});

describe("hatching", () => {
  it("draws the same hatching for the same seed", () => {
    expect(hatch(SQUARE, { seed: 5, gap: 4 })).toBe(hatch(SQUARE, { seed: 5, gap: 4 }));
  });

  it("stays inside the shape", () => {
    for (const angle of [-41, 0, 49, 90]) {
      const path = hatch(SQUARE, { seed: 5, gap: 4, angle });
      expect(path).not.toContain("NaN");
      for (const [x, y] of points(path)) {
        expect(x).toBeGreaterThan(8);
        expect(x).toBeLessThan(112);
        expect(y).toBeGreaterThan(8);
        expect(y).toBeLessThan(112);
      }
    }
  });

  it("draws more lines when they lie closer together", () => {
    const open = hatch(SQUARE, { seed: 5, gap: 8 }).match(/M/g)!.length;
    const dense = hatch(SQUARE, { seed: 5, gap: 2 }).match(/M/g)!.length;
    expect(dense).toBeGreaterThan(open * 3);
  });

  it("leaves the dent of a slice of more than half a circle empty", () => {
    // Three quarters of a circle: the quarter from 9 to 12 o'clock is not part of it.
    const corners = slice([100, 100], 60, 0, 0.75);
    const path = hatch(corners, { seed: 2, gap: 3, angle: 0, rough: 0 });
    const strokes = path.split("M").filter(Boolean);
    expect(strokes.length).toBeGreaterThan(20);
    for (const one of strokes) {
      const [[x1, y1], , , [x2, y2]] = points(one);
      const middle: Point = [(x1 + x2) / 2, (y1 + y2) / 2];
      const inDent = middle[0] < 99 && middle[1] < 99 && Math.hypot(middle[0] - 100, middle[1] - 100) < 59;
      expect(inDent).toBe(false);
    }
  });

  it("draws nothing in a shape without area", () => {
    expect(hatch([[0, 0], [10, 0]] as Point[], { seed: 1, gap: 3, angle: 0 })).toBe("");
  });
});

describe("shares of a circle", () => {
  it("covers the circle in the order given", () => {
    const parts = shares([24, 14, 12, 50]);
    expect(parts[0].from).toBe(0);
    expect(parts.at(-1)!.to).toBeCloseTo(1);
    for (let index = 1; index < parts.length; index++) expect(parts[index].from).toBeCloseTo(parts[index - 1].to);
    expect(parts[0].to).toBeCloseTo(0.24);
    expect(parts[3].middle).toBeCloseTo(0.75);
  });

  it("gives a value of nothing a slice without width", () => {
    const parts = shares([1, 0, 1]);
    expect(parts[1].to).toBe(parts[1].from);
  });

  it("gives no slices when there is nothing to divide", () => {
    expect(shares([])).toEqual([]);
    expect(shares([0, 0])).toEqual([]);
  });
});

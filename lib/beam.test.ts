import { describe, expect, it } from "vitest";
import {
  angleDiff,
  beamMode,
  angleTo,
  clampAngle,
  isInBeam,
  normalizeAngle,
  stepToward,
  sweepAngle,
} from "./beam";

const o = { x: 100, y: 100 };

describe("normalizeAngle", () => {
  it("wraps into [0, 360)", () => {
    expect(normalizeAngle(0)).toBe(0);
    expect(normalizeAngle(360)).toBe(0);
    expect(normalizeAngle(-90)).toBe(270);
    expect(normalizeAngle(725)).toBe(5);
  });
});

describe("angleDiff", () => {
  it("is the signed shortest rotation", () => {
    expect(angleDiff(10, 30)).toBe(20);
    expect(angleDiff(30, 10)).toBe(-20);
    expect(angleDiff(350, 10)).toBe(20);
    expect(angleDiff(10, 350)).toBe(-20);
  });
  it("returns 180 (not -180) for the opposite direction", () => {
    expect(angleDiff(0, 180)).toBe(180);
    expect(angleDiff(180, 0)).toBe(180);
  });
  it("is 0 for equal angles", () => {
    expect(angleDiff(45, 45)).toBe(0);
  });
});

describe("angleTo", () => {
  it("uses 0 right, 90 down, 180 left, 270 up", () => {
    expect(angleTo(o, { x: 200, y: 100 })).toBeCloseTo(0);
    expect(angleTo(o, { x: 100, y: 200 })).toBeCloseTo(90);
    expect(angleTo(o, { x: 0, y: 100 })).toBeCloseTo(180);
    expect(angleTo(o, { x: 100, y: 0 })).toBeCloseTo(270);
    expect(angleTo(o, { x: 200, y: 200 })).toBeCloseTo(45);
  });
  it("returns 0 for a zero-distance target", () => {
    expect(angleTo(o, o)).toBe(0);
  });
});

describe("clampAngle", () => {
  it("keeps angles inside the arc, ends included", () => {
    expect(clampAngle(120, 90, 200)).toBe(120);
    expect(clampAngle(90, 90, 200)).toBe(90);
    expect(clampAngle(200, 90, 200)).toBe(200);
  });
  it("snaps to the nearer end", () => {
    expect(clampAngle(60, 90, 200)).toBe(90);
    expect(clampAngle(230, 90, 200)).toBe(200);
  });
  it("uses angular distance across the wrap", () => {
    expect(clampAngle(-10, 90, 200)).toBe(90); // 350: 100 from 90, 150 from 200
    expect(clampAngle(300, 90, 200)).toBe(200); // 100 from 200, 150 from 90
    expect(clampAngle(-100, 90, 200)).toBe(200); // 260
  });
  it("normalizes input", () => {
    expect(clampAngle(480, 90, 200)).toBe(120);
  });
});

describe("stepToward", () => {
  it("covers the given share of the difference", () => {
    expect(stepToward(100, 200, 0.15)).toBeCloseTo(115);
    expect(stepToward(100, 200, 1)).toBeCloseTo(200);
    expect(stepToward(100, 200, 0)).toBe(100);
  });
  it("goes the short way round", () => {
    expect(stepToward(350, 10, 0.5)).toBeCloseTo(0);
    expect(stepToward(10, 350, 0.5)).toBeCloseTo(0);
  });
});

describe("isInBeam", () => {
  const angle = 180; // pointing left
  it("accepts points on the axis", () => {
    expect(isInBeam(o, angle, 10, 1200, { x: -400, y: 100 })).toBe(true);
  });
  it("accepts a point on the edge and rejects just outside", () => {
    const edge = (deg: number) => ({
      x: o.x + 100 * Math.cos((deg * Math.PI) / 180),
      y: o.y + 100 * Math.sin((deg * Math.PI) / 180),
    });
    expect(isInBeam(o, angle, 10, 1200, edge(190))).toBe(true);
    expect(isInBeam(o, angle, 10, 1200, edge(170))).toBe(true);
    expect(isInBeam(o, angle, 10, 1200, edge(191))).toBe(false);
    expect(isInBeam(o, angle, 10, 1200, edge(169))).toBe(false);
  });
  it("rejects points beyond the length, accepts exactly at it", () => {
    expect(isInBeam(o, angle, 10, 200, { x: -101, y: 100 })).toBe(false);
    expect(isInBeam(o, angle, 10, 200, { x: -100, y: 100 })).toBe(true);
  });
  it("rejects points behind the beam", () => {
    expect(isInBeam(o, angle, 10, 1200, { x: 300, y: 100 })).toBe(false);
  });
  it("works across the 0/360 wrap", () => {
    expect(isInBeam(o, 355, 10, 1200, { x: 300, y: 110 })).toBe(true);
    expect(isInBeam(o, 5, 10, 1200, { x: 300, y: 90 })).toBe(true);
  });
  it("treats the origin itself as inside", () => {
    expect(isInBeam(o, angle, 10, 1200, o)).toBe(true);
  });
});

describe("sweepAngle", () => {
  it("swings between max and min once per period", () => {
    expect(sweepAngle(0, 90, 200, 10000)).toBeCloseTo(200);
    expect(sweepAngle(5000, 90, 200, 10000)).toBeCloseTo(90);
    expect(sweepAngle(10000, 90, 200, 10000)).toBeCloseTo(200);
    expect(sweepAngle(2500, 90, 200, 10000)).toBeCloseTo(145);
  });
  it("never leaves the arc", () => {
    for (let t = 0; t < 20000; t += 137) {
      const a = sweepAngle(t, 90, 200, 10000);
      expect(a).toBeGreaterThanOrEqual(90 - 1e-9);
      expect(a).toBeLessThanOrEqual(200 + 1e-9);
    }
  });
});

describe("beamMode", () => {
  const base = { reduced: false, touchOnly: false, hasPointer: false, now: 1000, idleUntil: 5000 };
  it("is fixed with reduced motion, whatever else is going on", () => {
    expect(beamMode({ ...base, reduced: true })).toBe("fixed");
    expect(beamMode({ ...base, reduced: true, hasPointer: true })).toBe("fixed");
  });
  it("is fixed on a touch-only screen, even right after load or a scroll", () => {
    expect(beamMode({ ...base, touchOnly: true })).toBe("fixed");
    expect(beamMode({ ...base, touchOnly: true, now: 9000 })).toBe("fixed");
  });
  it("follows the pointer while it is over the card", () => {
    expect(beamMode({ ...base, hasPointer: true })).toBe("follow");
    expect(beamMode({ ...base, hasPointer: true, now: 9000 })).toBe("follow");
  });
  it("sweeps until idleUntil, then rests", () => {
    expect(beamMode(base)).toBe("sweep");
    expect(beamMode({ ...base, now: 4999 })).toBe("sweep");
    expect(beamMode({ ...base, now: 5000 })).toBe("rest");
    expect(beamMode({ ...base, now: 60000 })).toBe("rest");
  });
});

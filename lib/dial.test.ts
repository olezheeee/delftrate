import { describe, expect, it } from "vitest";
import { angleForValue, band, beamShape, keyStep, snap, valueFromPoint } from "./dial";

const c = { x: 100, y: 100 };

describe("snap", () => {
  it("rounds to the nearest half", () => {
    expect(snap(4.74)).toBe(4.5);
    expect(snap(4.76)).toBe(5);
    expect(snap(7)).toBe(7);
  });
  it("clamps", () => {
    expect(snap(-3)).toBe(0);
    expect(snap(12)).toBe(10);
  });
});

describe("angleForValue", () => {
  it("maps the ends and the middle", () => {
    expect(angleForValue(0)).toBe(180);
    expect(angleForValue(5)).toBe(270);
    expect(angleForValue(10)).toBe(360);
    expect(angleForValue(2.5)).toBe(225);
  });
  it("stays within 180..360", () => {
    expect(angleForValue(-1)).toBe(180);
    expect(angleForValue(99)).toBe(360);
  });
});

describe("valueFromPoint", () => {
  it("reads the arc", () => {
    expect(valueFromPoint(c, { x: 20, y: 100 })).toBe(0);
    expect(valueFromPoint(c, { x: 100, y: 20 })).toBe(5);
    expect(valueFromPoint(c, { x: 180, y: 100 })).toBe(10);
    expect(valueFromPoint(c, { x: 100 - 50, y: 100 - 50 })).toBe(2.5);
    expect(valueFromPoint(c, { x: 150, y: 50 })).toBe(7.5);
  });
  it("snaps", () => {
    const a = (v: number) => (angleForValue(v) * Math.PI) / 180;
    const p = (v: number) => ({ x: 100 + 50 * Math.cos(a(v)), y: 100 + 50 * Math.sin(a(v)) });
    expect(valueFromPoint(c, p(4.74))).toBe(4.5);
    expect(valueFromPoint(c, p(4.76))).toBe(5);
  });
  it("sends points below the centre line to the nearer end", () => {
    expect(valueFromPoint(c, { x: 40, y: 140 })).toBe(0);
    expect(valueFromPoint(c, { x: 160, y: 140 })).toBe(10);
    expect(valueFromPoint(c, { x: 99, y: 101 })).toBe(0);
    expect(valueFromPoint(c, { x: 101, y: 101 })).toBe(10);
  });
  it("returns null at the centre", () => {
    expect(valueFromPoint(c, c)).toBeNull();
  });
});

describe("keyStep", () => {
  it("steps a rated value", () => {
    expect(keyStep(5, "ArrowRight")).toBe(5.5);
    expect(keyStep(5, "ArrowUp")).toBe(5.5);
    expect(keyStep(5, "ArrowLeft")).toBe(4.5);
    expect(keyStep(5, "ArrowDown")).toBe(4.5);
    expect(keyStep(5, "PageUp")).toBe(6);
    expect(keyStep(5, "PageDown")).toBe(4);
    expect(keyStep(5, "Home")).toBe(0);
    expect(keyStep(5, "End")).toBe(10);
  });
  it("clamps", () => {
    expect(keyStep(10, "ArrowRight")).toBe(10);
    expect(keyStep(9.5, "PageUp")).toBe(10);
    expect(keyStep(0, "ArrowLeft")).toBe(0);
    expect(keyStep(0.5, "PageDown")).toBe(0);
  });
  it("starts an unrated dial at 5", () => {
    for (const k of ["ArrowRight", "ArrowUp", "ArrowLeft", "ArrowDown", "PageUp", "PageDown"]) {
      expect(keyStep(null, k)).toBe(5);
    }
    expect(keyStep(null, "Home")).toBe(0);
    expect(keyStep(null, "End")).toBe(10);
  });
  it("ignores other keys", () => {
    expect(keyStep(5, "a")).toBeNull();
    expect(keyStep(null, "Tab")).toBeNull();
  });
});

describe("band", () => {
  it("has the right boundaries", () => {
    expect(band(0)).toBe("Poor");
    expect(band(2.5)).toBe("Poor");
    expect(band(3)).toBe("Weak");
    expect(band(4.5)).toBe("Weak");
    expect(band(5)).toBe("Fine");
    expect(band(6.5)).toBe("Fine");
    expect(band(7)).toBe("Good");
    expect(band(8.5)).toBe("Good");
    expect(band(9)).toBe("Excellent");
    expect(band(10)).toBe("Excellent");
  });
});

describe("beamShape", () => {
  it("grows with the value", () => {
    const lo = beamShape(0);
    const hi = beamShape(10);
    expect(lo.halfWidth).toBeCloseTo(6);
    expect(lo.opacity).toBeCloseTo(0.1);
    expect(hi.halfWidth).toBeCloseTo(14);
    expect(hi.opacity).toBeCloseTo(0.28);
    expect(beamShape(5).halfWidth).toBeCloseTo(10);
  });
});

import { describe, expect, it } from "vitest";
import {
  GRAVITY,
  MAX_DT,
  PALETTE,
  SHOW_LENGTH,
  WHITE,
  createShow,
  isShowDone,
  stepShow,
  type Show,
} from "./fireworks";

function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const W = 400;
const H = 600;

function run(show: Show, seconds: number, random: () => number) {
  let s = show;
  for (let t = 0; t < seconds; t += 1 / 60) s = stepShow(s, 1 / 60, random);
  return s;
}

describe("fireworks", () => {
  it("starts with 5 rockets at the bottom, away from the sides", () => {
    const show = createShow(W, H, seeded(1));
    expect(show.rockets).toHaveLength(5);
    expect(show.particles).toHaveLength(0);
    for (const r of show.rockets) {
      expect(r.y).toBe(H);
      expect(r.x).toBeGreaterThan(W * 0.1);
      expect(r.x).toBeLessThan(W * 0.9);
      expect(r.exploded).toBe(false);
    }
  });

  it("explodes every rocket in the upper part of the card", () => {
    const random = seeded(2);
    let s = createShow(W, H, random);
    const seen = new Set<number>();
    for (let i = 0; i < 60 * 3; i++) {
      const before = s.rockets.map((r) => r.exploded);
      s = stepShow(s, 1 / 60, random);
      s.rockets.forEach((r, idx) => {
        if (r.exploded && !before[idx]) {
          seen.add(idx);
          expect(r.y).toBeLessThanOrEqual(H * 0.56);
          expect(r.y).toBeGreaterThanOrEqual(H * 0.14);
        }
      });
    }
    expect(seen.size).toBe(5);
  });

  it("makes 40-64 particles of one burst colour or white", () => {
    const random = seeded(3);
    let s = createShow(W, H, random);
    while (!s.rockets.some((r) => r.exploded)) s = stepShow(s, 1 / 60, random);
    expect(s.particles.length).toBeGreaterThanOrEqual(40);
    expect(s.particles.length).toBeLessThanOrEqual(64);
    const nonWhite = [...new Set(s.particles.map((p) => p.color))].filter(
      (c) => c !== WHITE,
    );
    expect(nonWhite.length).toBeLessThanOrEqual(1);
    for (const c of nonWhite) expect(PALETTE).toContain(c);
  });

  it("makes particles fall under gravity and fade", () => {
    const random = seeded(4);
    let s = createShow(W, H, random);
    while (s.particles.length === 0) s = stepShow(s, 1 / 60, random);
    const p0 = s.particles[0];
    const later = stepShow(s, 1 / 60, random).particles[0];
    expect(later.life).toBeLessThan(p0.life);
    const rest: Show = {
      ...s,
      rockets: s.rockets.map((r) => ({ ...r, exploded: true })),
      particles: [{ ...p0, vx: 0, vy: 0 }],
    };
    const out = stepShow(rest, 1 / 60, random).particles[0];
    expect(out.vy).toBeCloseTo(GRAVITY / 60, 5);
    expect(out.y).toBeGreaterThan(p0.y);
  });

  it("is done within 2.8 s of simulated time", () => {
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const random = seeded(seed);
      let s = createShow(W, H, random);
      expect(isShowDone(s)).toBe(false);
      let t = 0;
      while (!isShowDone(s) && t < 5) {
        s = stepShow(s, 1 / 60, random);
        t += 1 / 60;
      }
      expect(isShowDone(s)).toBe(true);
      expect(t).toBeLessThanOrEqual(SHOW_LENGTH + 0.05);
    }
  });

  it("is deterministic with a seeded random", () => {
    const a = run(createShow(W, H, seeded(9)), 1.5, seeded(10));
    const b = run(createShow(W, H, seeded(9)), 1.5, seeded(10));
    expect(a).toEqual(b);
  });

  it("caps dt", () => {
    const a = stepShow(createShow(W, H, seeded(5)), 10, seeded(6));
    const b = stepShow(createShow(W, H, seeded(5)), MAX_DT, seeded(6));
    expect(a).toEqual(b);
    expect(a.time).toBeCloseTo(MAX_DT);
  });
});

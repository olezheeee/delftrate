/**
 * Pure maths for the rating dial. Angles follow lib/beam.ts: degrees, 0 points
 * right, clockwise on screen (y points down); 180 is left (value 0), 270 is up
 * (value 5) and 360 is right (value 10).
 */
import type { Point } from "./beam";
import { loadColour, teachColour } from "./calendar";

export const STEP = 0.5;
export const MIN = 0;
export const MAX = 10;
export const ANGLE_AT_MIN = 180;
export const ANGLE_AT_MAX = 360;

export type Band = "Poor" | "Weak" | "Fine" | "Good" | "Excellent";
export type HardnessBand = "Very easy" | "Easy" | "Moderate" | "Hard" | "Very hard";
/** "quality": higher is better (interest, the professor). "hardness": higher is harder. */
export type Scale = "quality" | "hardness";

/** Nearest multiple of STEP, clamped to MIN..MAX. */
export function snap(value: number): number {
  const clamped = Math.min(MAX, Math.max(MIN, value));
  return Math.round(clamped / STEP) * STEP;
}

/** Angle of the dial needle for a value, in [180, 360]. */
export function angleForValue(value: number): number {
  const v = Math.min(MAX, Math.max(MIN, value));
  return ANGLE_AT_MIN + ((ANGLE_AT_MAX - ANGLE_AT_MIN) * (v - MIN)) / (MAX - MIN);
}

/**
 * Value for a pointer position, snapped. Points on or below the centre line go
 * to the nearer end; the centre itself gives null.
 */
export function valueFromPoint(centre: Point, point: Point): number | null {
  const dx = point.x - centre.x;
  const dy = point.y - centre.y;
  if (dx === 0 && dy === 0) return null;
  if (dy >= 0) return dx < 0 ? MIN : MAX;
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 360; // dy < 0: in (180, 360)
  return snap(((angle - ANGLE_AT_MIN) / (ANGLE_AT_MAX - ANGLE_AT_MIN)) * (MAX - MIN) + MIN);
}

/** The value a key leads to, or null for keys the dial does not handle. */
export function keyStep(value: number | null, key: string): number | null {
  let delta: number;
  switch (key) {
    case "ArrowRight":
    case "ArrowUp":
      delta = STEP;
      break;
    case "ArrowLeft":
    case "ArrowDown":
      delta = -STEP;
      break;
    case "PageUp":
      delta = 1;
      break;
    case "PageDown":
      delta = -1;
      break;
    case "Home":
      return MIN;
    case "End":
      return MAX;
    default:
      return null;
  }
  if (value === null) return 5;
  return snap(value + delta);
}

export function band(value: number): Band {
  if (value < 3) return "Poor";
  if (value < 5) return "Weak";
  if (value < 7) return "Fine";
  if (value < 9) return "Good";
  return "Excellent";
}

/** The word under a dial. Difficulty and exam level are not good or bad, only hard or easy. */
export function bandFor(value: number, scale: Scale): Band | HardnessBand {
  if (scale === "quality") return band(value);
  if (value < 3) return "Very easy";
  if (value < 5) return "Easy";
  if (value < 7) return "Moderate";
  if (value < 9) return "Hard";
  return "Very hard";
}

/** Outer wedge of the beam: wider and brighter for higher values. */
export function beamShape(value: number): { halfWidth: number; opacity: number } {
  const t = (Math.min(MAX, Math.max(MIN, value)) - MIN) / (MAX - MIN);
  return { halfWidth: 6 + 8 * t, opacity: 0.1 + 0.18 * t };
}

/**
 * What a touch that has moved (dx, dy) pixels since it landed is doing. Under `slop` it is still
 * undecided (it may yet be a tap); past it, a mostly sideways move is a drag along the arc and
 * anything else is a scroll of the page, which must not rate. The band allows only vertical
 * panning, so the browser does not scroll a mostly sideways swipe; should it scroll anyway, it
 * cancels the pointer, and the move that decided the drag has not rated anything yet.
 */
export function classifyTouch(dx: number, dy: number, slop: number): "undecided" | "drag" | "scroll" {
  if (Math.hypot(dx, dy) < slop) return "undecided";
  return Math.abs(dx) > Math.abs(dy) ? "drag" : "scroll";
}

/** The zone at the top of a dial: "extreme" for a hardness dial from 9 ("Very hard"), "top" for a quality dial from 9.5. */
export type Zone = "extreme" | "top";
export const EXTREME_FROM = 9;
export const TOP_FROM = 9.5;
/** A clear red for a very hard subject, and a green for the best ratings. */
export const EXTREME_COLOUR = "rgb(244 98 88)";
export const TOP_COLOUR = "rgb(120 220 150)";

/** The zone a value is in, or null (also for an unrated dial, null). */
export function zoneFor(value: number | null, scale: Scale): Zone | null {
  if (value === null) return null;
  if (scale === "hardness") return value >= EXTREME_FROM ? "extreme" : null;
  return value >= TOP_FROM ? "top" : null;
}

/** The colour of a rated dial: loadColour(value) for "hardness", teachColour(value) for "quality"; the zone colour inside a zone. */
export function dialColour(value: number, scale: Scale): string {
  const zone = zoneFor(value, scale);
  if (zone === "extreme") return EXTREME_COLOUR;
  if (zone === "top") return TOP_COLOUR;
  return scale === "hardness" ? loadColour(value) : teachColour(value);
}

/** True when a change from `previous` (null: not rated yet) to `next` moves the dial into its zone from outside it. Moving within the zone, or out of it, is false. */
export function entersZone(previous: number | null, next: number, scale: Scale): boolean {
  return zoneFor(next, scale) !== null && zoneFor(previous, scale) === null;
}

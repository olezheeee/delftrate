/**
 * Pure maths for the rating dial. Angles follow lib/beam.ts: degrees, 0 points
 * right, clockwise on screen (y points down); 180 is left (value 0), 270 is up
 * (value 5) and 360 is right (value 10).
 */
import type { Point } from "./beam";

export const STEP = 0.5;
export const MIN = 0;
export const MAX = 10;
export const ANGLE_AT_MIN = 180;
export const ANGLE_AT_MAX = 360;

export type Band = "Poor" | "Weak" | "Fine" | "Good" | "Excellent";

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

/** Outer wedge of the beam: wider and brighter for higher values. */
export function beamShape(value: number): { halfWidth: number; opacity: number } {
  const t = (Math.min(MAX, Math.max(MIN, value)) - MIN) / (MAX - MIN);
  return { halfWidth: 6 + 8 * t, opacity: 0.1 + 0.18 * t };
}

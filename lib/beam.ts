/**
 * Pure maths for the lighthouse beam. Degrees; 0 points right and angles grow
 * clockwise on screen (y points down): 90 is down, 180 left, 270 up.
 */
export type Point = { x: number; y: number };

/** The arc the beam may cover: from straight down, through left, to a little above left. */
export const BEAM_ARC_MIN = 90;
export const BEAM_ARC_MAX = 200;
/** Where the beam rests before anything else has happened. */
export const BEAM_REST_ANGLE = 135;
/** Where the beam rests under prefers-reduced-motion: down and to the left. */
export const BEAM_REDUCED_ANGLE = 135;
export const BEAM_HALF_WIDTH = 10;
export const BEAM_INNER_HALF_WIDTH = 4;
/** Long enough to cross a 720px card diagonally. */
export const BEAM_LENGTH = 1200;
export const BEAM_SWEEP_PERIOD_MS = 10000;
/** Share of the remaining difference covered each frame while following. */
export const BEAM_FOLLOW_FACTOR = 0.15;

/** Wraps any angle into [0, 360). */
export function normalizeAngle(angle: number): number {
  return ((angle % 360) + 360) % 360;
}

/** Signed shortest rotation from `from` to `to`, in (-180, 180]. */
export function angleDiff(from: number, to: number): number {
  const d = normalizeAngle(to - from);
  return d > 180 ? d - 360 : d;
}

/** Angle of the line from `origin` to `target`, in [0, 360). */
export function angleTo(origin: Point, target: Point): number {
  const deg = (Math.atan2(target.y - origin.y, target.x - origin.x) * 180) / Math.PI;
  return normalizeAngle(deg);
}

/** Keeps `angle` inside the arc [min, max] (which must not cross 0); outside goes to the nearer end. */
export function clampAngle(angle: number, min: number, max: number): number {
  const a = normalizeAngle(angle);
  if (a >= min && a <= max) return a;
  return Math.abs(angleDiff(a, min)) <= Math.abs(angleDiff(a, max)) ? min : max;
}

/** Moves `current` a share `factor` of the way to `target`, the short way round. */
export function stepToward(current: number, target: number, factor: number): number {
  return normalizeAngle(current + angleDiff(current, target) * factor);
}

/** Whether `point` is inside the wedge from `origin` along `angle` (inclusive edges). */
export function isInBeam(
  origin: Point,
  angle: number,
  halfWidth: number,
  length: number,
  point: Point,
): boolean {
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const dist = Math.hypot(dx, dy);
  if (dist > length) return false;
  if (dist === 0) return true;
  return Math.abs(angleDiff(angle, angleTo(origin, point))) <= halfWidth + 1e-9;
}

/** Back-and-forth angle across [min, max], starting at max, one full cycle per `periodMs`. */
export function sweepAngle(timeMs: number, min: number, max: number, periodMs: number): number {
  const mid = (min + max) / 2;
  const amp = (max - min) / 2;
  return mid + amp * Math.cos((2 * Math.PI * timeMs) / periodMs);
}

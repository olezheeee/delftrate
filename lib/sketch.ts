// Hand-drawn strokes for the booklets: lines that wobble a little, outlines gone over
// twice like a pen, and fills hatched like a coloured pencil.
//
// Everything here is a pure function of its numbers and a seed. The same seed draws the
// same picture, so the server, a reload and a printed copy all show one drawing.

export type Point = readonly [number, number];

// A small repeatable random generator (mulberry32): numbers from 0 up to 1.
export function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A seed from a text, so a drawing can be tied to what it shows (a title, a topic name).
export function seedOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// One decimal is finer than a screen or a printer shows, and keeps the page small.
function n(value: number): string {
  return String(Math.round(value * 10) / 10);
}

// One pen stroke from a to b: the ends land a little off and the line bows a little.
function stroke(a: Point, b: Point, random: () => number, rough: number): string {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy) || 1;
  const off = Math.min(rough, length / 10);
  const jitter = () => (random() * 2 - 1) * off;
  // Sideways, at a right angle to the stroke. A long stroke bows more than a short one.
  const bow = (random() * 2 - 1) * Math.min(rough * (0.4 + length / 160), length / 14);
  const nx = (-dy / length) * bow;
  const ny = (dx / length) * bow;
  const first = 0.28 + random() * 0.12;
  const second = 0.6 + random() * 0.12;
  return (
    `M${n(a[0] + jitter())} ${n(a[1] + jitter())}` +
    `C${n(a[0] + dx * first + nx + jitter() / 2)} ${n(a[1] + dy * first + ny + jitter() / 2)}` +
    ` ${n(a[0] + dx * second + nx + jitter() / 2)} ${n(a[1] + dy * second + ny + jitter() / 2)}` +
    ` ${n(b[0] + jitter())} ${n(b[1] + jitter())}`
  );
}

export type Pen = {
  seed: number;
  // How unsteady the hand is, in the units of the drawing. 1 suits a line of 100 or more.
  rough?: number;
  // How often the pen goes over the line.
  passes?: number;
};

// A straight line drawn by hand.
export function line(a: Point, b: Point, { seed, rough = 1, passes = 2 }: Pen): string {
  const random = seeded(seed);
  let path = "";
  for (let pass = 0; pass < passes; pass++) path += stroke(a, b, random, rough);
  return path;
}

// The outline of a shape with corners: one line per side.
export function outline(corners: readonly Point[], pen: Pen): string {
  return corners
    .map((corner, index) => line(corner, corners[(index + 1) % corners.length], { ...pen, seed: pen.seed + index * 7919 }))
    .join("");
}

// A smooth curve through points (Catmull-Rom, written as cubic Béziers).
function through(points: readonly Point[]): string {
  let path = `M${n(points[0][0])} ${n(points[0][1])}`;
  for (let index = 0; index < points.length - 1; index++) {
    const before = points[Math.max(index - 1, 0)];
    const from = points[index];
    const to = points[index + 1];
    const after = points[Math.min(index + 2, points.length - 1)];
    path +=
      `C${n(from[0] + (to[0] - before[0]) / 6)} ${n(from[1] + (to[1] - before[1]) / 6)}` +
      ` ${n(to[0] - (after[0] - from[0]) / 6)} ${n(to[1] - (after[1] - from[1]) / 6)}` +
      ` ${n(to[0])} ${n(to[1])}`;
  }
  return path;
}

// Angles are in turns from 12 o'clock, clockwise: 0.25 is 3 o'clock. That is how a share
// of a circle diagram reads.
export function onCircle(centre: Point, radius: number, turn: number): Point {
  const angle = turn * 2 * Math.PI;
  return [centre[0] + radius * Math.sin(angle), centre[1] - radius * Math.cos(angle)];
}

// Part of a circle, or all of it, drawn by hand. A whole circle (from 0 to 1) runs a little
// past its start, as a pen does when it closes a ring.
export function arc(centre: Point, radius: number, from: number, to: number, { seed, rough = 1, passes = 2 }: Pen): string {
  const random = seeded(seed);
  const whole = to - from >= 1;
  let path = "";
  for (let pass = 0; pass < passes; pass++) {
    const start = from + (whole ? (random() - 0.5) * 0.08 : 0);
    const end = to + (whole ? 0.03 + random() * 0.04 : 0);
    const steps = Math.max(3, Math.ceil((end - start) * 28));
    const drift = (random() * 2 - 1) * rough * 0.6;
    const points: Point[] = [];
    for (let step = 0; step <= steps; step++) {
      const at = step / steps;
      // The hand drifts in or out slowly along the way and trembles a little on top.
      const r = radius + drift * (at - 0.5) * 2 + (random() * 2 - 1) * rough * 0.35;
      points.push(onCircle(centre, r, start + (end - start) * at));
    }
    path += through(points);
  }
  return path;
}

// The corners of a slice of a circle, close enough together to pass for its curve. Used to
// hatch the slice.
export function slice(centre: Point, radius: number, from: number, to: number): Point[] {
  const steps = Math.max(2, Math.ceil((to - from) * 90));
  const points: Point[] = to - from >= 1 ? [] : [centre];
  for (let step = 0; step <= steps; step++) points.push(onCircle(centre, radius, from + ((to - from) * step) / steps));
  return points;
}

export type Hatching = {
  seed: number;
  // Distance between the pencil lines.
  gap: number;
  // Direction of the lines in degrees: 0 is level, negative leans up to the right.
  angle?: number;
  rough?: number;
};

// Fills a shape with parallel pencil lines. Works for any shape with corners, also one
// with a dent (a slice of more than half a circle).
export function hatch(corners: readonly Point[], { seed, gap, angle = -41, rough = 0.5 }: Hatching): string {
  const random = seeded(seed);
  const radians = (angle * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  // Turn the shape so that the pencil lines lie level, cut it into level lines, turn back.
  const turned = corners.map(([x, y]): Point => [x * cos + y * sin, -x * sin + y * cos]);
  const back = ([x, y]: Point): Point => [x * cos - y * sin, x * sin + y * cos];
  const top = Math.min(...turned.map((point) => point[1]));
  const bottom = Math.max(...turned.map((point) => point[1]));

  let path = "";
  for (let y = top + gap * (0.35 + random() * 0.3); y < bottom; y += gap * (0.88 + random() * 0.24)) {
    const crossings: number[] = [];
    for (let index = 0; index < turned.length; index++) {
      const a = turned[index];
      const b = turned[(index + 1) % turned.length];
      // Half-open, so a line through a corner counts that corner once.
      if (a[1] <= y === b[1] <= y) continue;
      crossings.push(a[0] + ((y - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    crossings.sort((left, right) => left - right);
    for (let index = 0; index + 1 < crossings.length; index += 2) {
      const left = crossings[index];
      const right = crossings[index + 1];
      if (right - left < 0.6) continue;
      path += stroke(back([left, y]), back([right, y]), random, Math.min(rough, (right - left) / 8));
    }
  }
  return path;
}

// ---------------------------------------------------------------------------
// Circle diagrams
// ---------------------------------------------------------------------------

export type Share = { from: number; to: number; middle: number };

// Where each value's slice starts and ends, in turns, in the order given. Values that add
// up to nothing give no slices.
export function shares(values: readonly number[]): Share[] {
  const total = values.reduce((sum, value) => sum + value, 0);
  if (total <= 0) return [];
  let passed = 0;
  return values.map((value) => {
    const from = passed / total;
    passed += value;
    const to = passed / total;
    return { from, to, middle: (from + to) / 2 };
  });
}

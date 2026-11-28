// Pure fireworks simulation: no DOM, random function injectable for tests.

export const PALETTE = ["#7fd0f7", "#8fe0b0", "#ff9d8a", "#f2b46a"] as const;
export const WHITE = "#ffffff";

export const ROCKET_COUNT = 5;
/** Rockets launch within this many seconds. */
export const LAUNCH_WINDOW = 1.2;
export const RISE_TIME_MIN = 0.45;
export const RISE_TIME_MAX = 0.55;
/** Side margin as a fraction of the width. */
export const SIDE_MARGIN = 0.15;
/** Explosion height, as a fraction of the card height measured from the top. */
export const TARGET_MIN = 0.15;
export const TARGET_MAX = 0.55;
export const PARTICLES_MIN = 40;
export const PARTICLES_MAX = 64;
export const SPEED_MIN = 70;
export const SPEED_MAX = 210;
/** px per second squared, downwards. */
export const GRAVITY = 160;
/** Exponential air drag per second. */
export const DRAG = 1.6;
export const LIFE_MIN = 0.9;
export const LIFE_MAX = 1.6;
/** The whole show is over by this time (seconds). */
export const SHOW_LENGTH = 2.8;
export const MAX_DT = 0.05;
export const WHITE_CHANCE = 0.12;
export const RING_CHANCE = 0.35;
export const WOBBLE_AMPLITUDE = 6;

export type Rocket = {
  x0: number;
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  targetY: number;
  delay: number;
  riseTime: number;
  age: number;
  ring: boolean;
  color: string;
  wobblePhase: number;
  exploded: boolean;
};

export type Particle = {
  x: number;
  y: number;
  prevX: number;
  prevY: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
};

export type Show = {
  width: number;
  height: number;
  time: number;
  rockets: Rocket[];
  particles: Particle[];
};

export function createShow(
  width: number,
  height: number,
  random: () => number = Math.random,
): Show {
  const rockets: Rocket[] = [];
  const usable = width * (1 - 2 * SIDE_MARGIN);
  const slot = usable / ROCKET_COUNT;
  // Shuffle which slot launches first so the show is not a left-to-right sweep.
  const order = Array.from({ length: ROCKET_COUNT }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (let i = 0; i < ROCKET_COUNT; i++) {
    const x0 = width * SIDE_MARGIN + (order[i] + 0.15 + random() * 0.7) * slot;
    const delay = (i / (ROCKET_COUNT - 1)) * LAUNCH_WINDOW * (0.9 + random() * 0.1);
    rockets.push({
      x0,
      x: x0,
      y: height,
      prevX: x0,
      prevY: height,
      targetY: height * (TARGET_MIN + random() * (TARGET_MAX - TARGET_MIN)),
      delay: Math.min(delay, LAUNCH_WINDOW),
      riseTime: RISE_TIME_MIN + random() * (RISE_TIME_MAX - RISE_TIME_MIN),
      age: 0,
      ring: random() < RING_CHANCE,
      color: PALETTE[Math.floor(random() * PALETTE.length)],
      wobblePhase: random() * Math.PI * 2,
      exploded: false,
    });
  }
  return { width, height, time: 0, rockets, particles: [] };
}

function explode(rocket: Rocket, time: number, random: () => number): Particle[] {
  const count =
    PARTICLES_MIN + Math.floor(random() * (PARTICLES_MAX - PARTICLES_MIN + 1));
  const ringSpeed = SPEED_MIN + (SPEED_MAX - SPEED_MIN) * (0.6 + random() * 0.4);
  const out: Particle[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rocket.ring
      ? (i / count) * Math.PI * 2
      : random() * Math.PI * 2;
    const speed = rocket.ring
      ? ringSpeed
      : SPEED_MIN + random() * (SPEED_MAX - SPEED_MIN);
    // Never outlive the show.
    const wanted = LIFE_MIN + random() * (LIFE_MAX - LIFE_MIN);
    const maxLife = Math.max(0.2, Math.min(wanted, SHOW_LENGTH - time));
    out.push({
      x: rocket.x,
      y: rocket.y,
      prevX: rocket.x,
      prevY: rocket.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: maxLife,
      maxLife,
      color: random() < WHITE_CHANCE ? WHITE : rocket.color,
    });
  }
  return out;
}

export function stepShow(
  state: Show,
  dtSeconds: number,
  random: () => number = Math.random,
): Show {
  const dt = Math.max(0, Math.min(dtSeconds, MAX_DT));
  const time = state.time + dt;
  const newParticles: Particle[] = [];

  const rockets = state.rockets.map((r) => {
    if (r.exploded) return r;
    if (time <= r.delay) return r;
    const age = Math.min(time - r.delay, r.riseTime);
    const p = age / r.riseTime;
    const next: Rocket = {
      ...r,
      age,
      prevX: r.x,
      prevY: r.y,
      x: r.x0 + Math.sin(age * 14 + r.wobblePhase) * WOBBLE_AMPLITUDE * p,
      y: state.height + (r.targetY - state.height) * p,
    };
    if (age >= r.riseTime) {
      next.exploded = true;
      newParticles.push(...explode(next, time, random));
    }
    return next;
  });

  const decay = Math.exp(-DRAG * dt);
  const particles: Particle[] = [];
  for (const q of state.particles) {
    const life = q.life - dt;
    if (life <= 0) continue;
    const vx = q.vx * decay;
    const vy = q.vy * decay + GRAVITY * dt;
    particles.push({
      ...q,
      prevX: q.x,
      prevY: q.y,
      x: q.x + vx * dt,
      y: q.y + vy * dt,
      vx,
      vy,
      life,
    });
  }
  particles.push(...newParticles);

  return { width: state.width, height: state.height, time, rockets, particles };
}

export function isShowDone(state: Show): boolean {
  return state.rockets.every((r) => r.exploded) && state.particles.length === 0;
}

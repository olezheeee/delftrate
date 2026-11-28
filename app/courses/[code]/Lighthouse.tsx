"use client";

import { useEffect, useRef } from "react";
import {
  BEAM_ARC_MAX,
  BEAM_ARC_MIN,
  BEAM_FOLLOW_FACTOR,
  BEAM_HALF_WIDTH,
  BEAM_IDLE_SWEEP_MS,
  BEAM_INNER_HALF_WIDTH,
  BEAM_LENGTH,
  BEAM_REDUCED_ANGLE,
  BEAM_REST_ANGLE,
  BEAM_SWEEP_PERIOD_MS,
  angleDiff,
  angleTo,
  beamMode,
  clampAngle,
  isInBeam,
  stepToward,
  sweepAngle,
  type Point,
} from "@/lib/beam";
import styles from "./Lighthouse.module.css";

// The beam has four modes (see beamMode in lib/beam.ts):
// - fixed: with reduced motion or on a touch-only screen the beam stays at one angle and never
//   moves, not at load and not on scroll. Frames are only used to relight the targets once
//   after a resize or scroll.
// - follow: with a mouse over the card the beam turns toward the pointer, and stops scheduling
//   frames once it has settled.
// - sweep: with a mouse elsewhere the beam sweeps back and forth, but only for a few seconds
//   after the last pointer movement over the card or scroll.
// - rest: after that the beam stays at the angle it reached and no frames are scheduled until
//   the pointer moves over the card or the page scrolls.
// Frames are also paused while the tab is hidden or the card is out of view.

// Tower drawing space is 56 x 112; the lamp centre sits at (28, 22).
const LAMP = { x: 28, y: 22 };
const SETTLED = 0.05; // degrees
// While sweeping, the lit targets are checked on every fourth frame only: the beam moves
// slowly, and reading every rect on every frame costs battery.
const SWEEP_HIT_EVERY = 4;

function wedge(halfWidth: number, length: number): string {
  // Rounded: the server and the browser may differ in the last digit of a tangent, and the
  // drawing they each render has to be the same text.
  const h = Math.round(length * Math.tan((halfWidth * Math.PI) / 180) * 100) / 100;
  return `0,0 ${length},${-h} ${length},${h}`;
}

export function Lighthouse({
  className,
  windows,
  lit,
  complete,
}: {
  className?: string;
  windows: number;
  lit: number;
  complete: boolean;
}) {
  const lampRef = useRef<SVGCircleElement>(null);
  const layerRef = useRef<SVGSVGElement>(null);
  const groupRef = useRef<SVGGElement>(null);
  const outerRef = useRef<SVGPolygonElement>(null);
  const innerRef = useRef<SVGPolygonElement>(null);

  useEffect(() => {
    const layer = layerRef.current;
    const lamp = lampRef.current;
    const group = groupRef.current;
    const container = layer?.parentElement;
    if (!layer || !lamp || !group || !container) return;
    // A browser without these observers (an old web view) keeps the drawing without a moving
    // beam, rather than failing the whole card.
    if (
      typeof ResizeObserver === "undefined" ||
      typeof IntersectionObserver === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return;
    }

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const hoverQuery = window.matchMedia("(hover: none)");
    let reduced = reducedQuery.matches;
    let touchOnly = hoverQuery.matches;
    // The idle sweep runs until this time, then rests; pointer movement and scrolling extend it.
    let idleUntil = performance.now() + BEAM_IDLE_SWEEP_MS;
    let frameCount = 0;
    let frame = 0;
    let inView = true;
    let pointer: Point | null = null; // client coordinates, only while over the card
    let angle = reduced || touchOnly ? BEAM_REDUCED_ANGLE : BEAM_REST_ANGLE;
    let origin: Point | null = null; // relative to the container
    let originDirty = true;
    // The beam reaches across the whole card, which is far taller than wide: its length is
    // the card's diagonal, measured with the lamp.
    let length = BEAM_LENGTH;
    const litNow = new Set<Element>();

    function measureOrigin(box: DOMRect) {
      const r = lamp!.getBoundingClientRect();
      origin = { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
      originDirty = false;
      const next = Math.max(BEAM_LENGTH, Math.ceil(Math.hypot(box.width, box.height)));
      if (next !== length) {
        length = next;
        outerRef.current?.setAttribute("points", wedge(BEAM_HALF_WIDTH, length));
        innerRef.current?.setAttribute("points", wedge(BEAM_INNER_HALF_WIDTH, length));
      }
    }

    function tick(now: number) {
      frame = 0;
      const box = container!.getBoundingClientRect();
      if (originDirty || !origin) measureOrigin(box);
      const o = origin!;

      const mode = beamMode({ reduced, touchOnly, hasPointer: !!pointer, now, idleUntil });
      let target = angle;
      if (mode === "fixed") {
        target = BEAM_REDUCED_ANGLE;
      } else if (mode === "follow" && pointer) {
        const p = { x: pointer.x - box.left, y: pointer.y - box.top };
        target = clampAngle(angleTo(o, p), BEAM_ARC_MIN, BEAM_ARC_MAX);
      } else if (mode === "sweep") {
        target = sweepAngle(now, BEAM_ARC_MIN, BEAM_ARC_MAX, BEAM_SWEEP_PERIOD_MS);
      }
      // "rest" keeps the angle it reached.

      angle = mode === "fixed" ? target : stepToward(angle, target, BEAM_FOLLOW_FACTOR);
      const settled = Math.abs(angleDiff(angle, target)) < SETTLED;
      const following = mode === "follow";
      if (following && settled) angle = target;

      group!.setAttribute("transform", `translate(${o.x} ${o.y}) rotate(${angle})`);

      const sweeping = mode === "sweep";
      frameCount += 1;
      if (sweeping && frameCount % SWEEP_HIT_EVERY !== 0) {
        schedule();
        return;
      }

      // Read every rect first, then write only the attributes that change.
      const targets = container!.querySelectorAll("[data-beam-target]");
      const hits: boolean[] = [];
      targets.forEach((el) => {
        const r = el.getBoundingClientRect();
        const c = { x: r.left + r.width / 2 - box.left, y: r.top + r.height / 2 - box.top };
        hits.push(isInBeam(o, angle, BEAM_HALF_WIDTH, length, c));
      });
      targets.forEach((el, i) => {
        const on = litNow.has(el);
        if (hits[i] && !on) {
          litNow.add(el);
          el.setAttribute("data-lit", "true");
        } else if (!hits[i] && on) {
          litNow.delete(el);
          el.removeAttribute("data-lit");
        }
      });
      litNow.forEach((el) => {
        if (!el.isConnected) litNow.delete(el);
      });

      // Follow mode stops once settled; fixed and rest modes stop after this frame (hits are
      // recomputed on resize and scroll); the idle sweep goes on until idleUntil.
      if (sweeping || (following && !settled)) schedule();
    }

    function schedule() {
      if (frame || !inView || document.hidden) return;
      frame = requestAnimationFrame(tick);
    }
    function cancel() {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
    }

    function onPointerMove(e: PointerEvent) {
      if (reduced || touchOnly || e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      idleUntil = performance.now() + BEAM_IDLE_SWEEP_MS;
      schedule();
    }
    function onPointerLeave(e: PointerEvent) {
      // Browsers fire this for a finger when it lifts; only the mouse leaving counts.
      if (e.pointerType === "touch") return;
      pointer = null;
      // Sweep on for a while from where the pointer left, then rest.
      idleUntil = performance.now() + BEAM_IDLE_SWEEP_MS;
      schedule();
    }
    // A beam that never moves (touch screens, reduced motion) is relit once the scrolling has
    // stopped, not on every frame of it: reading every target's position costs battery.
    let scrollTimer: ReturnType<typeof setTimeout> | undefined;
    function onScroll() {
      originDirty = true;
      idleUntil = performance.now() + BEAM_IDLE_SWEEP_MS;
      if (reduced || touchOnly) {
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(schedule, 150);
        return;
      }
      schedule();
    }
    function onVisibility() {
      if (document.hidden) cancel();
      else schedule();
    }
    function onMotionChange() {
      reduced = reducedQuery.matches;
      touchOnly = hoverQuery.matches;
      if (reduced || touchOnly) pointer = null;
      else idleUntil = performance.now() + BEAM_IDLE_SWEEP_MS;
      schedule();
    }

    const resizeObserver = new ResizeObserver(() => {
      originDirty = true;
      schedule();
    });
    const intersection = new IntersectionObserver((entries) => {
      inView = entries[entries.length - 1].isIntersecting;
      if (inView) schedule();
      else cancel();
    });

    // In the fixed and rest modes no frames run, so new targets (the tips of another professor)
    // would stay unlit until the next scroll. One frame on every change of the card's content.
    const mutation = new MutationObserver(() => schedule());

    resizeObserver.observe(container);
    intersection.observe(container);
    mutation.observe(container, { childList: true, subtree: true });
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onMotionChange);
    hoverQuery.addEventListener("change", onMotionChange);
    schedule();

    return () => {
      cancel();
      clearTimeout(scrollTimer);
      resizeObserver.disconnect();
      intersection.disconnect();
      mutation.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onMotionChange);
      hoverQuery.removeEventListener("change", onMotionChange);
      litNow.forEach((el) => el.removeAttribute("data-lit"));
      litNow.clear();
    };
  }, []);

  const count = Math.max(0, Math.floor(windows));
  const litCount = Math.min(Math.max(0, Math.floor(lit)), count);
  // Windows stack up the tower: index 0 is the lowest and lights first.
  const areaBottom = 102;
  const slot = count > 0 ? (areaBottom - 42) / count : 0;
  const winH = Math.min(7, slot * 0.6);

  return (
    <>
      <svg
        className={`${styles.tower} ${className ?? ""}`.trim()}
        viewBox="0 0 56 112"
        role="img"
        aria-label={`Lighthouse, ${litCount} of ${count} windows lit`}
      >
        <polygon className={styles.body} points="19,34 37,34 43,108 13,108" />
        <rect className={styles.room} x="20" y="14" width="16" height="17" rx="1" />
        <circle
          ref={lampRef}
          className={`${styles.lamp} ${complete ? styles.lampComplete : ""}`}
          cx={LAMP.x}
          cy={LAMP.y}
          r="5"
        />
        <rect className={styles.rail} x="15" y="30" width="26" height="4" rx="1" />
        <polygon className={styles.roof} points="28,3 38,14 18,14" />
        {Array.from({ length: count }, (_, i) => {
          const y = areaBottom - slot * (i + 1) + (slot - winH) / 2;
          return (
            <rect
              key={i}
              className={`${styles.window} ${i < litCount ? styles.windowLit : ""}`}
              x="25"
              y={y}
              width="6"
              height={winH}
              rx="1"
            />
          );
        })}
      </svg>
      <svg
        ref={layerRef}
        className={`${styles.beam} ${complete ? styles.beamComplete : ""}`}
        aria-hidden="true"
      >
        <g ref={groupRef} transform="translate(-9999 -9999)">
          <polygon ref={outerRef} className={styles.outer} points={wedge(BEAM_HALF_WIDTH, BEAM_LENGTH)} />
          <polygon ref={innerRef} className={styles.inner} points={wedge(BEAM_INNER_HALF_WIDTH, BEAM_LENGTH)} />
        </g>
      </svg>
    </>
  );
}

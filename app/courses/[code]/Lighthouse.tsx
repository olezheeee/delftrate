"use client";

import { useEffect, useRef } from "react";
import {
  BEAM_ARC_MAX,
  BEAM_ARC_MIN,
  BEAM_FOLLOW_FACTOR,
  BEAM_HALF_WIDTH,
  BEAM_INNER_HALF_WIDTH,
  BEAM_LENGTH,
  BEAM_REDUCED_ANGLE,
  BEAM_REST_ANGLE,
  BEAM_SWEEP_PERIOD_MS,
  angleDiff,
  angleTo,
  clampAngle,
  isInBeam,
  stepToward,
  sweepAngle,
  type Point,
} from "@/lib/beam";
import styles from "./Lighthouse.module.css";

// Tower drawing space is 56 x 112; the lamp centre sits at (28, 22).
const LAMP = { x: 28, y: 22 };
const SETTLED = 0.05; // degrees
// While sweeping, the lit targets are checked on every fourth frame only: the beam moves
// slowly, and reading every rect on every frame costs battery.
const SWEEP_HIT_EVERY = 4;
// On a touch screen (no hover) the idle sweep rests after this long, and starts again when
// the page scrolls, so a course page left open does not animate forever.
const TOUCH_SWEEP_MS = 12000;

function wedge(halfWidth: number, length: number): string {
  const h = length * Math.tan((halfWidth * Math.PI) / 180);
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

    const reducedQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const touchOnly = window.matchMedia("(hover: none)").matches;
    let reduced = reducedQuery.matches;
    let sweepUntil = performance.now() + TOUCH_SWEEP_MS;
    let frameCount = 0;
    let frame = 0;
    let inView = true;
    let pointer: Point | null = null; // client coordinates, only while over the card
    let angle = reduced ? BEAM_REDUCED_ANGLE : BEAM_REST_ANGLE;
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

      let target: number;
      let following = false;
      const resting = touchOnly && !pointer && now > sweepUntil;
      if (reduced) {
        target = BEAM_REDUCED_ANGLE;
      } else if (resting) {
        target = angle;
      } else if (pointer) {
        following = true;
        const p = { x: pointer.x - box.left, y: pointer.y - box.top };
        target = clampAngle(angleTo(o, p), BEAM_ARC_MIN, BEAM_ARC_MAX);
      } else {
        target = sweepAngle(now, BEAM_ARC_MIN, BEAM_ARC_MAX, BEAM_SWEEP_PERIOD_MS);
      }

      angle = reduced ? target : stepToward(angle, target, BEAM_FOLLOW_FACTOR);
      const settled = Math.abs(angleDiff(angle, target)) < SETTLED;
      if (following && settled) angle = target;

      group!.setAttribute("transform", `translate(${o.x} ${o.y}) rotate(${angle})`);

      const sweeping = !reduced && !following && !resting;
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

      // Follow mode stops once settled, reduced and resting modes after this frame; the idle
      // sweep goes on (on touch screens only until sweepUntil).
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
      if (reduced || e.pointerType === "touch") return;
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    }
    function onPointerLeave() {
      pointer = null;
      schedule();
    }
    function onScroll() {
      originDirty = true;
      sweepUntil = performance.now() + TOUCH_SWEEP_MS;
      schedule();
    }
    function onVisibility() {
      if (document.hidden) cancel();
      else schedule();
    }
    function onReducedChange() {
      reduced = reducedQuery.matches;
      if (reduced) pointer = null;
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

    resizeObserver.observe(container);
    intersection.observe(container);
    container.addEventListener("pointermove", onPointerMove);
    container.addEventListener("pointerleave", onPointerLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    reducedQuery.addEventListener("change", onReducedChange);
    schedule();

    return () => {
      cancel();
      resizeObserver.disconnect();
      intersection.disconnect();
      container.removeEventListener("pointermove", onPointerMove);
      container.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("scroll", onScroll);
      document.removeEventListener("visibilitychange", onVisibility);
      reducedQuery.removeEventListener("change", onReducedChange);
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

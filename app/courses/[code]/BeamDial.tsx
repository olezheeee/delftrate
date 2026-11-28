"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  MAX,
  MIN,
  angleForValue,
  bandFor,
  beamShape,
  type Scale,
  classifyTouch,
  keyStep,
  valueFromPoint,
} from "@/lib/dial";
import styles from "./BeamDial.module.css";

const CX = 100;
const CY = 100;
const R = 80;
const BAND_R = 68;
// The band is invisible, so it can be as thick as the finger needs. 64 units is about 28px when
// the dial renders 90px wide (a narrow phone); the old 36 was only about 16px.
const BAND_WIDTH = 64;
const BEAM_LENGTH = 74;
const TICK_COUNT = 21;
const TAP_SLOP = 8; // px a finger may move and still count as a tap
const STAGGER_MS = 4; // 20 ticks x 4ms = 80ms, plus the 300ms transition: under 400ms

// Rounded to two decimals: the server and the browser may differ in the last digit of a
// cosine, and the drawing they each render has to be the same text.
function polar(radius: number, value: number) {
  const a = (angleForValue(value) * Math.PI) / 180;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { x: round(CX + radius * Math.cos(a)), y: round(CY + radius * Math.sin(a)) };
}

function wedge(halfWidth: number, length: number): string {
  const h = (halfWidth * Math.PI) / 180;
  const x = (length * Math.cos(h)).toFixed(2);
  const y = (length * Math.sin(h)).toFixed(2);
  return `M0 0 L${x} -${y} L${x} ${y} Z`;
}

const ARC_PATH = (() => {
  const a = polar(BAND_R, MIN);
  const b = polar(BAND_R, MAX);
  return `M${a.x} ${a.y} A${BAND_R} ${BAND_R} 0 0 1 ${b.x} ${b.y}`;
})();

const TICKS = Array.from({ length: TICK_COUNT }, (_, i) => {
  const v = i / 2;
  const len = v % 5 === 0 ? 14 : Number.isInteger(v) ? 10 : 6;
  return { v, from: polar(R, v), to: polar(R - len, v) };
});

const LABELS = [
  { text: "0", x: 9, y: 104 },
  { text: "5", x: 100, y: 11 },
  { text: "10", x: 191, y: 104 },
];

function format(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function BeamDial(props: {
  id: string;
  label: string;
  hint: string;
  value: number | null;
  onChange: (value: number) => void;
  /** Which words describe the value: "hardness" for difficulty and exam level. */
  scale?: Scale;
}) {
  const { id, label, hint, value, onChange, scale = "quality" } = props;
  const [pressed, setPressed] = useState(false);
  const [following, setFollowing] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const rated = value !== null;
  const labelId = `${id}-label`;
  const hintId = `${id}-hint`;

  function commit(next: number | null) {
    if (next === null) return;
    if (value === null || next !== value) onChange(next);
  }

  function fromEvent(e: PointerEvent): number | null {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const scale = rect.width / 200;
    return valueFromPoint(
      { x: rect.left + CX * scale, y: rect.top + CY * scale },
      { x: e.clientX, y: e.clientY },
    );
  }

  // A finger that lands on the arc may only be scrolling the page, which must not count as a
  // rating. So for touch nothing happens on pointer down: a tap (little movement) or a
  // sideways drag rates, and an upward or downward swipe is left to the browser to scroll
  // (the band allows vertical panning). A pen pans the page like a finger, so it follows the
  // same rules. A mouse rates at once.
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);
  // The pointer of the drag along the arc that is under way, or null. We keep our own record
  // because hasPointerCapture is no use here: browsers capture touch pointers implicitly on
  // pointer down, so it is already true on the first move of a scroll swipe. It is tied to one
  // pointer, so a second finger on the band never moves the dial.
  const dragging = useRef<number | null>(null);

  // A mouse rates where it presses. A touch or pen drag rates only from its next move on: the
  // move that decided it was a drag might still turn into a scroll of the page, and a scroll
  // must leave the dial as it was.
  function startDrag(e: PointerEvent<SVGPathElement>, rateNow: boolean) {
    dragging.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    wrapRef.current?.focus({ preventScroll: true });
    setPressed(true);
    if (rateNow) commit(fromEvent(e));
  }

  function onPointerDown(e: PointerEvent<SVGPathElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    // A second pointer (another finger, or the mouse of a touchscreen laptop), while one drags
    // or is still being decided, is ignored.
    if (dragging.current !== null || touchStart.current !== null) return;
    if (e.pointerType === "touch" || e.pointerType === "pen") {
      // The browser's implicit capture is kept: it sends this finger's moves here even when it
      // slides off the band, so the gesture is always decided. It does not stop the page from
      // scrolling: a vertical swipe ends in pointercancel.
      // The pen of a graphics tablet is not captured that way, so it is captured here: without
      // it, a pen that slides off the band and lifts would leave its record behind for good.
      if (e.pointerType === "pen") e.currentTarget.setPointerCapture(e.pointerId);
      touchStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    startDrag(e, true);
  }

  function onPointerMove(e: PointerEvent<SVGPathElement>) {
    if (dragging.current !== null) {
      if (e.pointerId !== dragging.current) return;
      setFollowing(true);
      commit(fromEvent(e));
      return;
    }
    const start = touchStart.current;
    if (!start || start.id !== e.pointerId) return;
    const kind = classifyTouch(e.clientX - start.x, e.clientY - start.y, TAP_SLOP);
    if (kind === "undecided") return;
    touchStart.current = null; // decided: it can no longer become a tap
    if (kind === "drag") startDrag(e, false); // sideways: a drag along the arc
    // "scroll": leave it to the browser; nothing is rated
  }

  function release(e: PointerEvent<SVGPathElement>) {
    // Each record is cleared only by its own pointer: another pointer lifting must not end the
    // drag or the undecided touch, or rate, and must not leave a record behind either.
    const tapped = touchStart.current?.id === e.pointerId;
    const dragged = dragging.current === e.pointerId;
    if (!tapped && !dragged) return;
    if (tapped) touchStart.current = null;
    if (dragged) dragging.current = null;
    // A tap (the finger went down and up without moving far) rates where it lifted, and so does
    // the end of a drag, which may have been too short for a move of its own to rate. A cancel
    // (the browser taking over to scroll) never rates.
    if (e.type === "pointerup") {
      wrapRef.current?.focus({ preventScroll: true });
      commit(fromEvent(e));
    }
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setPressed(false);
    setFollowing(false);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    // With Alt, Ctrl or Cmd the arrows are the browser's own shortcuts (back, forward).
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const next = keyStep(value, e.key);
    if (next === null) return;
    e.preventDefault();
    commit(next);
  }

  const shape = beamShape(value ?? 0);
  const tileClass = [styles.tile, pressed ? styles.pressed : "", rated ? "" : styles.unrated]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={tileClass}>
      <div className={styles.label} id={labelId}>
        {label}
      </div>
      <div className={styles.hint} id={hintId}>
        {hint}
      </div>
      <div
        ref={wrapRef}
        className={styles.dial}
        role="slider"
        tabIndex={0}
        aria-labelledby={labelId}
        aria-describedby={hintId}
        aria-valuemin={MIN}
        aria-valuemax={MAX}
        // A slider must have a value: unrated, it is the middle, where the needle rests, and the
        // valuetext below says "Not rated yet", which is what screen readers announce.
        aria-valuenow={value ?? 5}
        aria-valuetext={value === null ? "Not rated yet" : `${format(value)} out of 10, ${bandFor(value, scale)}`}
        onKeyDown={onKeyDown}
      >
        <svg ref={svgRef} className={styles.svg} viewBox="0 0 200 116" aria-hidden="true">
          {TICKS.map((t, i) => {
            const lit = value !== null && t.v <= value;
            return (
              <line
                key={t.v}
                className={lit ? `${styles.tick} ${styles.lit}` : styles.tick}
                style={{ transitionDelay: lit ? `${i * STAGGER_MS}ms` : "0ms" }}
                x1={t.from.x}
                y1={t.from.y}
                x2={t.to.x}
                y2={t.to.y}
              />
            );
          })}
          {LABELS.map((l) => (
            <text key={l.text} className={styles.tickLabel} x={l.x} y={l.y} textAnchor="middle">
              {l.text}
            </text>
          ))}
          {/* The beam rotates around the lamp. Its CSS transform carries the move to the lamp
              as well, so the rotation origin is the same in every browser. */}
          {value === null ? (
              <g className={styles.ghost}>
                <path d={wedge(10, BEAM_LENGTH)} className={styles.ghostWedge} />
              </g>
            ) : (
              <g
                className={following ? `${styles.beam} ${styles.follow}` : styles.beam}
                style={{ transform: `translate(${CX}px, ${CY}px) rotate(${angleForValue(value)}deg)` }}
              >
                <path
                  d={wedge(shape.halfWidth, BEAM_LENGTH)}
                  className={styles.wedge}
                  style={{ fill: `rgb(127 208 247 / ${shape.opacity})` }}
                />
                <path
                  d={wedge(shape.halfWidth / 2, BEAM_LENGTH)}
                  className={styles.wedge}
                  style={{ fill: `rgb(127 208 247 / ${Math.min(1, shape.opacity + 0.1)})` }}
                />
              </g>
            )}
          <g transform={`translate(${CX} ${CY})`}>
            <rect className={styles.base} x={-10} y={0} width={20} height={8} rx={2} />
            {value === MAX ? <circle className={styles.shine} r={7} /> : null}
            <circle className={styles.lamp} r={6} />
          </g>
          <path
            className={styles.band}
            d={ARC_PATH}
            strokeWidth={BAND_WIDTH}
            fill="none"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={release}
            onPointerCancel={release}
            onLostPointerCapture={(e) => {
              // The browser took the pointer away without an up or a cancel: the drag, or the
              // touch that was still being decided, is over.
              if (touchStart.current?.id === e.pointerId) touchStart.current = null;
              if (e.pointerId !== dragging.current) return;
              dragging.current = null;
              setPressed(false);
              setFollowing(false);
            }}
          />
        </svg>
        <div className={styles.readout}>
          <span key={value ?? "none"} className={rated ? `${styles.value} ${styles.pop}` : styles.value}>
            {value === null ? "–" : format(value)}
          </span>
          <span className={styles.caption}>{value === null ? "Drag to rate" : bandFor(value, scale)}</span>
        </div>
      </div>
    </div>
  );
}

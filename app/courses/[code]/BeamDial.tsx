"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import { MAX, MIN, angleForValue, band, beamShape, keyStep, valueFromPoint } from "@/lib/dial";
import styles from "./BeamDial.module.css";

const CX = 100;
const CY = 100;
const R = 80;
const BAND_R = 68;
const BAND_WIDTH = 36;
const BEAM_LENGTH = 74;
const TICK_COUNT = 21;
const TAP_SLOP = 8; // px a finger may move and still count as a tap
const STAGGER_MS = 4; // 20 ticks x 4ms = 80ms, plus the 300ms transition: under 400ms

function polar(radius: number, value: number) {
  const a = (angleForValue(value) * Math.PI) / 180;
  return { x: CX + radius * Math.cos(a), y: CY + radius * Math.sin(a) };
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
}) {
  const { id, label, hint, value, onChange } = props;
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
  // (the band allows vertical panning). Mouse and pen rate at once.
  const touchStart = useRef<{ id: number; x: number; y: number } | null>(null);

  function startDrag(e: PointerEvent<SVGPathElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    wrapRef.current?.focus({ preventScroll: true });
    setPressed(true);
    commit(fromEvent(e));
  }

  function onPointerDown(e: PointerEvent<SVGPathElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.pointerType === "touch") {
      touchStart.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
      return;
    }
    startDrag(e);
  }

  function onPointerMove(e: PointerEvent<SVGPathElement>) {
    const start = touchStart.current;
    if (start && start.id === e.pointerId && !e.currentTarget.hasPointerCapture(e.pointerId)) {
      const dx = e.clientX - start.x;
      const dy = e.clientY - start.y;
      if (Math.hypot(dx, dy) < TAP_SLOP) return;
      touchStart.current = null;
      if (Math.abs(dx) > Math.abs(dy)) startDrag(e); // sideways: a drag along the arc
      return; // otherwise a scroll: leave it to the browser
    }
    if (!e.currentTarget.hasPointerCapture(e.pointerId)) return;
    setFollowing(true);
    commit(fromEvent(e));
  }

  function release(e: PointerEvent<SVGPathElement>) {
    const start = touchStart.current;
    touchStart.current = null;
    // A tap: the finger went down and up without moving far.
    if (e.type === "pointerup" && start && start.id === e.pointerId) {
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
        aria-valuenow={value ?? 5}
        aria-valuetext={value === null ? "Not rated yet" : `${format(value)} out of 10, ${band(value)}`}
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
          />
        </svg>
        <div className={styles.readout}>
          <span key={value ?? "none"} className={rated ? `${styles.value} ${styles.pop}` : styles.value}>
            {value === null ? "–" : format(value)}
          </span>
          <span className={styles.caption}>{value === null ? "Drag to rate" : band(value)}</span>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { createShow, isShowDone, stepShow, type Show } from "@/lib/fireworks";
import styles from "./Fireworks.module.css";

const LINE_WIDTH = 2;

export function Fireworks({ burst }: { burst: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const showsRef = useRef<Show[]>([]);
  const frameRef = useRef<number | null>(null);
  const lastTimeRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0 });
  const handledRef = useRef(0);
  const stopRef = useRef<() => void>(() => {});

  // Size tracking and teardown, once per mount. The canvas covers the screen.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const readSize = () => {
      sizeRef.current = { width: window.innerWidth, height: window.innerHeight };
      // Only keep a buffer while a show runs.
      if (frameRef.current !== null) applyBuffer(canvas);
    };
    window.addEventListener("resize", readSize);
    readSize();

    const onVisibility = () => {
      if (document.hidden) stopRef.current();
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener("resize", readSize);
      document.removeEventListener("visibilitychange", onVisibility);
      stopRef.current();
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || burst <= handledRef.current) return;
    const added = burst - handledRef.current;
    handledRef.current = burst;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (document.hidden) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const stop = () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
      showsRef.current = [];
      canvas.width = 0;
      canvas.height = 0;
    };
    stopRef.current = stop;

    const { width, height } = sizeRef.current;
    if (width === 0 || height === 0) return;
    for (let i = 0; i < added; i++) showsRef.current.push(createShow(width, height));

    if (frameRef.current !== null) return; // loop already running

    applyBuffer(canvas);
    lastTimeRef.current = performance.now();

    const frame = (now: number) => {
      const dt = Math.min((now - lastTimeRef.current) / 1000, 0.05);
      lastTimeRef.current = now;
      showsRef.current = showsRef.current
        .map((s) => stepShow(s, dt))
        .filter((s) => !isShowDone(s));
      if (showsRef.current.length === 0) {
        stop();
        return;
      }
      draw(ctx, canvas, showsRef.current);
      frameRef.current = requestAnimationFrame(frame);
    };
    frameRef.current = requestAnimationFrame(frame);

  }, [burst]);

  return <canvas ref={canvasRef} className={styles.canvas} aria-hidden="true" />;
}

function applyBuffer(canvas: HTMLCanvasElement) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
  canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
}

function draw(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  shows: Show[],
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.lineCap = "round";
  ctx.lineWidth = LINE_WIDTH;

  for (const show of shows) {
    // Rockets: a small bright dot with a short streak.
    for (const r of show.rockets) {
      if (r.exploded || r.age <= 0) continue;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = r.color;
      ctx.beginPath();
      ctx.moveTo(r.x, r.y + 10);
      ctx.lineTo(r.x, r.y);
      ctx.stroke();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Particles: streaks from previous to current position, faded by alpha.
    for (const p of show.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = Math.max(0, Math.min(1, t * 1.4));
      ctx.strokeStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.prevX, p.prevY);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

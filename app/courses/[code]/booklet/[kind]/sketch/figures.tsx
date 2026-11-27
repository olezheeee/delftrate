// The drawn parts of the hand-drawn booklet: circle diagrams, bars, badges and underlines.
// All of them are plain SVG made on the server from lib/sketch.ts; no script runs in the
// browser, and a printed page shows the same drawing.
import { arc, hatch, line, onCircle, outline, seedOf, shares, slice, type Point } from "@/lib/sketch";
import type { Pencil } from "./colours";
import styles from "./Sketch.module.css";

const INK = "var(--ink)";

function Fill({ corners, pencil, seed, gap, angle }: { corners: Point[]; pencil: Pencil; seed: number; gap: number; angle: number }) {
  return (
    <path
      d={
        hatch(corners, { seed, gap, angle }) +
        (pencil.crossed ? hatch(corners, { seed: seed + 1, gap: gap * 1.25, angle: angle + 90 }) : "")
      }
      className={styles.pencil}
      stroke={pencil.colour}
    />
  );
}

export type PieSlice = {
  // What the slice is of, for the tooltip and for screen readers: "Complex numbers: 9%".
  title: string;
  // The number or letter written on it, the same as in the list beside the diagram.
  mark: string;
  value: number;
  pencil: Pencil;
};

// A circle diagram: the slices in the order given, clockwise from 12 o'clock. The list
// beside it carries the names and the exact values; this is the picture of it.
export function Pie({ label, slices }: { label: string; slices: PieSlice[] }) {
  const centre: Point = [150, 150];
  const radius = 120;
  const seed = seedOf(label);
  const parts = shares(slices.map((item) => item.value));

  return (
    <svg className={styles.pie} viewBox="0 0 300 300" role="img" aria-label={label}>
      {parts.map((part, index) =>
        part.to > part.from ? (
          <g key={index} className={styles.slice}>
            <title>{slices[index].title}</title>
            {/* The whole slice answers the pointer, not only its pencil lines. */}
            <polygon
              className={styles.hit}
              points={slice(centre, radius, part.from, part.to)
                .map((point) => `${Math.round(point[0] * 10) / 10},${Math.round(point[1] * 10) / 10}`)
                .join(" ")}
            />
            {/* Each slice is hatched in its own direction, as when colouring one by one. */}
            <Fill
              corners={slice(centre, radius - 1.5, part.from, part.to)}
              pencil={slices[index].pencil}
              seed={seed + index * 101}
              gap={3.4}
              angle={-41 + index * 37}
            />
          </g>
        ) : null,
      )}
      <path d={arc(centre, radius, 0, 1, { seed, rough: 1.3 })} className={styles.pen} stroke={INK} />
      {parts.length > 1 &&
        parts.map((part, index) =>
          part.to > part.from ? (
            <path
              key={index}
              d={line(centre, onCircle(centre, radius, part.from), { seed: seed + index * 13, rough: 0.9 })}
              className={styles.pen}
              stroke={INK}
            />
          ) : null,
        )}
      {parts.map((part, index) => {
        if (part.to <= part.from) return null;
        // A slice too thin to write in gets its mark outside, with a tick to it.
        const inside = part.to - part.from >= 0.065;
        const at = onCircle(centre, inside ? radius * 0.64 : radius + 19, part.middle);
        return (
          <g key={index} aria-hidden="true">
            {!inside && (
              <path
                d={line(onCircle(centre, radius + 3, part.middle), onCircle(centre, radius + 11, part.middle), {
                  seed: seed + index,
                  rough: 0.4,
                  passes: 1,
                })}
                className={styles.pen}
                stroke={INK}
              />
            )}
            <text x={at[0]} y={at[1]} className={styles.mark}>
              {slices[index].mark}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// One bar of a bar chart. Its length is the value against the longest bar of the chart;
// the number is written at its end. A value of nothing draws no bar.
export function Bar({
  label,
  value,
  max,
  pencil,
  dense,
}: {
  label: string;
  value: number;
  max: number;
  pencil: Pencil;
  // Dense hatching for exam points, open hatching for lecture time.
  dense: boolean;
}) {
  // Drawn at the width it has on a wide screen; a narrow screen squeezes it.
  const width = Math.max((value / max) * 380, 0);
  const seed = seedOf(label);
  const corners: Point[] = [
    [2, 3],
    [width, 3],
    [width, 15],
    [2, 15],
  ];
  return (
    <span className={styles.bar} role="img" aria-label={label}>
      {value > 0 && (
        <svg
          viewBox={`0 0 ${Math.round(width) + 2} 18`}
          preserveAspectRatio="none"
          style={{ width: `calc((100% - 3.4em) * ${value / max})` }}
          aria-hidden="true"
        >
          <Fill corners={corners} pencil={pencil} seed={seed} gap={dense ? 2.7 : 5.5} angle={dense ? -58 : -41} />
          <path d={outline(corners, { seed, rough: 0.7 })} className={styles.pen} stroke={INK} />
        </svg>
      )}
      <span className={styles.barValue} aria-hidden="true">
        {value}%
      </span>
    </span>
  );
}

// The number of a topic or the letter of a kind of question, in a ring coloured like its
// slice and its bars.
export function Badge({ mark, pencil, label }: { mark: string; pencil: Pencil; label?: string }) {
  const centre: Point = [18, 18];
  const seed = seedOf(`badge ${mark} ${pencil.colour}`);
  return (
    <svg className={styles.badge} viewBox="0 0 36 36" role="img" aria-label={label ?? mark}>
      <Fill corners={slice(centre, 13.5, 0, 1)} pencil={pencil} seed={seed} gap={3.2} angle={-41} />
      <path d={arc(centre, 14.5, 0, 1, { seed, rough: 0.7 })} className={styles.pen} stroke={INK} />
      <text x="18" y="18" className={styles.mark} aria-hidden="true">
        {mark}
      </text>
    </svg>
  );
}

// The line under a heading, drawn with a ruler that slipped a little.
export function Underline({ of }: { of: string }) {
  return (
    <svg className={styles.underline} viewBox="0 0 300 8" preserveAspectRatio="none" aria-hidden="true">
      <path d={line([2, 4], [298, 4.5], { seed: seedOf(of), rough: 1.5 })} className={styles.pen} stroke={INK} />
    </svg>
  );
}

// A small sample of a hatching, for the legend.
export function Swatch({ dense }: { dense: boolean }) {
  const corners: Point[] = [
    [2, 3],
    [38, 3],
    [38, 15],
    [2, 15],
  ];
  const seed = dense ? 11 : 12;
  return (
    <svg className={styles.swatch} viewBox="0 0 40 18" aria-hidden="true">
      <path
        d={hatch(corners, { seed, gap: dense ? 2.7 : 5.5, angle: dense ? -58 : -41 })}
        className={styles.pencil}
        stroke="var(--ink-soft)"
      />
      <path d={outline(corners, { seed, rough: 0.7 })} className={styles.pen} stroke={INK} />
    </svg>
  );
}

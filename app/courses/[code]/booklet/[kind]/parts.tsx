// Pieces both booklets are built from.
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./Booklet.module.css";

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function courseHref(code: string): string {
  return `/courses/${encodeURIComponent(code)}`;
}

// The top of a booklet: which booklet, of which course, and the way back and across.
export function BookletHead({
  code,
  label,
  title,
  lead,
  other,
  children,
}: {
  code: string;
  label: string;
  title: string;
  lead: string;
  // The other booklet of the pair.
  other: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <header className={styles.head}>
      <nav className={styles.nav} aria-label="Booklet">
        <Link href={courseHref(code)}>← {code}</Link>
        <Link href={other.href}>{other.label} →</Link>
      </nav>
      <span className="mono">
        {label} · {code}
      </span>
      <h1 className={styles.title}>
        {title} <em>{lead}</em>
      </h1>
      {children}
    </header>
  );
}

// A row of headline numbers.
export function Facts({ facts }: { facts: { value: string; label: string }[] }) {
  return (
    <dl className={styles.facts}>
      {facts.map((fact) => (
        <div key={fact.label}>
          <dt>{fact.label}</dt>
          <dd>{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className={styles.section}>
      <div className={styles.sectionHead}>
        <h2 className="mono">{title}</h2>
        {note && <span>{note}</span>}
      </div>
      {children}
    </section>
  );
}

export function Points({ items }: { items: string[] }) {
  return (
    <ul className={styles.points}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

// One bar of a chart. `series` picks the colour: the same measure has the same colour in
// both booklets. The value is printed at the tip of the bar, in the text colour.
export function Bar({
  series,
  value,
  max,
  label,
}: {
  series: "time" | "exam";
  value: number;
  max: number;
  // What the bar says in words, for the tooltip.
  label: string;
}) {
  return (
    <span className={styles.track} title={label}>
      {/* The number is in the list next to the bar; the bar itself is decoration to a screen reader. */}
      {/* A value of zero draws no bar: only its number is shown. */}
      {value > 0 && (
        <span
          className={styles.bar}
          data-series={series}
          style={{ width: `calc((100% - 3.2em) * ${max > 0 ? value / max : 0})` }}
          aria-hidden="true"
        />
      )}
      <span className={styles.value}>{value}%</span>
    </span>
  );
}

// The upper end of a chart's scale: the largest value, rounded up to a multiple of 5.
export function scaleMax(values: number[]): number {
  return Math.max(5, Math.ceil(Math.max(0, ...values) / 5) * 5);
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return <footer className={styles.disclaimer}>{children}</footer>;
}

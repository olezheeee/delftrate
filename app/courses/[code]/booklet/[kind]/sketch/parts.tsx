// Pieces both hand-drawn booklets are built from.
import Link from "next/link";
import type { ReactNode } from "react";
import { markedParts } from "@/lib/resources";
import { PrintButton } from "../PrintButton";
import { Underline } from "./figures";
import { hand } from "./font";
import styles from "./Sketch.module.css";

export function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function courseHref(code: string): string {
  return `/courses/${encodeURIComponent(code)}`;
}

// The sheet of paper with the top of a booklet on it: the way back, the way across to the
// other booklet, the title and the opening lines.
export function Sheet({
  code,
  title,
  about,
  other,
  children,
  intro,
}: {
  code: string;
  // The course, and what this booklet is about: "Calculus" and "what to know".
  title: string;
  about: string;
  other: { href: string; label: string };
  intro: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className={`${hand.variable} ${styles.sheet}`}>
      <nav className={styles.nav} aria-label="Booklet">
        <Link href={courseHref(code)}>← {code}</Link>
        <Link href={other.href}>{other.label} →</Link>
      </nav>
      <header className={styles.head}>
        {/* Print leaves out the way back, and with it the course code: here it is for the paper. */}
        <p className={styles.code}>{code}</p>
        <h1 className={styles.title}>
          {title}
          <span>
            {/* Joins the two for a screen reader and a copy of the text; the line break does that on the sheet. */}
            <i className={styles.unseen}>: </i>
            {about}
            <Underline of={`${code} ${about}`} />
          </span>
        </h1>
        {intro}
        <PrintButton className={styles.button} />
      </header>
      {children}
    </main>
  );
}

export function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section className={styles.section} id={id}>
      <h2 className={styles.heading}>
        {title}
        <Underline of={title} />
      </h2>
      {children}
    </section>
  );
}

// A plain list. The sign in front says what kind of line it is: a dash for a thing to
// know, an arrow for a thing to do, an exclamation mark for a thing to watch out for.
// What a line marks as "know this by heart" gets the highlighter.
export function Lines({ items, sign = "dash" }: { items: string[]; sign?: "dash" | "arrow" | "warning" }) {
  return (
    <ul className={styles.lines} data-sign={sign}>
      {items.map((item, index) => (
        <li key={index}>
          {markedParts(item).map((part, at) => (part.marked ? <mark key={at}>{part.text}</mark> : part.text))}
        </li>
      ))}
    </ul>
  );
}

// The closing note of a booklet: what it rests on and what it is not.
export function Rests({ children }: { children: ReactNode }) {
  return (
    <section className={`${styles.section} ${styles.rests}`}>
      <h2 className={styles.heading}>
        What this booklet rests on
        <Underline of="What this booklet rests on" />
      </h2>
      {children}
    </section>
  );
}

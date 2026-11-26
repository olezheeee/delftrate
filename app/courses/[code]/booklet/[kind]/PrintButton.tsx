"use client";

import styles from "./Booklet.module.css";

// A booklet is something to print or save as a PDF. The page has its own print layout.
export function PrintButton() {
  return (
    <button type="button" className={styles.print} onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}

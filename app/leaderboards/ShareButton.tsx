"use client";

import { useRef, useState } from "react";
import styles from "./Leaderboards.module.css";

// Copies the text of a board. The message sits in a live region so a screen reader says it.
export function ShareButton({ title, text }: { title: string; text: string }) {
  const [message, setMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  function show(next: string) {
    setMessage(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(""), 4000);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      show("Copied. Paste it in your group chat.");
    } catch {
      show("Could not copy. Select the rows and copy them by hand.");
    }
  }

  return (
    <span className={styles.shareWrap}>
      <button type="button" className={styles.share} onClick={copy} aria-label={`Share the ${title} board`}>
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M8 10V2M5 5l3-3 3 3M3 9v4h10V9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Share
      </button>
      <span className={styles.message} aria-live="polite">
        {message}
      </span>
    </span>
  );
}

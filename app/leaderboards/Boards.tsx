import Link from "next/link";
import type { CSSProperties } from "react";
import { shareText, type Board } from "@/lib/leaderboards";
import styles from "./Leaderboards.module.css";
import { ShareButton } from "./ShareButton";

export function Boards({ boards }: { boards: Board[] }) {
  return (
    <div className={styles.boards}>
      {boards.map((board) => (
        <article
          key={board.id}
          className={`${styles.board} ${board.big ? styles.xl : ""}`}
          style={board.colour ? ({ "--c": board.colour } as CSSProperties) : undefined}
        >
          <div className={styles.boardHead}>
            <span className="mono">Top {board.size}</span>
            {/* An empty board has nothing to share. */}
            {board.rows.length > 0 && <ShareButton title={board.title} text={shareText(board)} />}
          </div>
          <h2>{board.title}</h2>
          <p className={styles.desc}>{board.description}</p>
          {board.rows.length === 0 ? (
            <p className={styles.empty}>Not enough votes yet</p>
          ) : (
            <ol>
              {board.rows.map((row) => (
                <li key={row.rank}>
                  <Link
                    href={row.href}
                    className={styles.row}
                    aria-label={`Number ${row.rank}: ${row.title}, ${row.value.toFixed(1)} out of 10`}
                  >
                    <span className={styles.rank}>{String(row.rank).padStart(2, "0")}</span>
                    <span className={styles.name}>
                      <span>{row.title}</span>
                      <small>{row.subtitle}</small>
                    </span>
                    <span className={styles.value}>{row.value.toFixed(1)}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </article>
      ))}
    </div>
  );
}

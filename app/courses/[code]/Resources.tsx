// The "Resources" block of the course card: the two booklets and the study material the
// Lightspace archive holds for the course, as links. No state: it only shows what it gets.
import Link from "next/link";
import type { CourseResources, ResourceKind } from "@/lib/resources";
import styles from "./Resources.module.css";

// What the card needs to know about the booklets to link to them.
export type BookletSummary = {
  knowledge: { topics: number; lectures: number } | null;
  // `noun` is what the papers are: "past papers", or "practice papers" when that is all there is.
  exams: { papers: number; noun: string } | null;
};

const GROUP_LABELS: Record<ResourceKind, string> = {
  lectures: "Lectures",
  exams: "Past exams",
  solutions: "Solutions",
  notes: "Notes",
  textbooks: "Books",
  links: "Videos and links",
};

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

// "2026-11-26" as "26 November 2026". Locale and time zone are fixed, so the server and the
// browser write the same text.
function day(date: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${date}T00:00:00Z`),
  );
}

export function Resources({
  code,
  resources,
  booklets,
}: {
  code: string;
  resources: CourseResources | null;
  booklets: BookletSummary;
}) {
  const total = resources?.groups.reduce((sum, group) => sum + group.items.length, 0) ?? 0;
  const base = `/courses/${encodeURIComponent(code)}/booklet`;

  return (
    <section className={styles.block} aria-labelledby="resources-title">
      <div className={styles.head}>
        <h2 className="mono" id="resources-title">
          Resources
        </h2>
        {total > 0 && <span className={styles.count}>{plural(total, "item", "items")}</span>}
      </div>

      {booklets.knowledge && booklets.exams && (
        <div className={styles.booklets}>
          <Link href={`${base}/knowledge`} className={styles.booklet}>
            <span className="mono">Booklet 1</span>
            <b>What to know</b>
            <small>
              {plural(booklets.knowledge.topics, "topic", "topics")}, with the lecture time
              {booklets.exams.papers > 0 ? " and exam weight" : ""} of each
            </small>
          </Link>
          <Link href={`${base}/exams`} className={styles.booklet}>
            <span className="mono">Booklet 2</span>
            <b>{booklets.exams.papers > 0 ? "The exam" : "The assessment"}</b>
            <small>
              {booklets.exams.papers > 0
                ? `What ${booklets.exams.papers} ${booklets.exams.noun} ${booklets.exams.papers === 1 ? "shows" : "show"}, and how to prepare`
                : "How the course is assessed, and how to prepare"}
            </small>
          </Link>
        </div>
      )}

      {resources ? (
        <>
          <div className={styles.groups}>
            {resources.groups.map((group) => (
              <details key={group.kind} className={styles.group}>
                <summary>
                  {GROUP_LABELS[group.kind]}
                  <span>{group.items.length}</span>
                </summary>
                <ul>
                  {group.items.map((item, index) => (
                    // The archive may list one file under two headings, so the link alone is no key.
                    <li key={index}>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.title}
                        </a>
                      ) : (
                        <span>{item.title}</span>
                      )}
                      {(item.section || item.size) && (
                        <small>{[item.section, item.size].filter(Boolean).join(" · ")}</small>
                      )}
                    </li>
                  ))}
                </ul>
                {group.kind === "textbooks" && <p className={styles.note}>Books are listed by title only.</p>}
              </details>
            ))}
          </div>
          <p className={styles.source}>
            Material collected by{" "}
            <a href={resources.source.url} target="_blank" rel="noopener noreferrer">
              {resources.source.name}
            </a>
            , a student-run archive, and opened there. Not an official TU Delft source. List checked on{" "}
            {day(resources.source.retrieved)}.
          </p>
        </>
      ) : (
        <p className={styles.empty}>No study material has been collected for this course yet.</p>
      )}
    </section>
  );
}

// Booklet 2: what the past papers show, and how to prepare. A course without past papers
// (a project) gets "The assessment": how it is graded, without numbers.
import { papersNoun, type ExamBooklet, type PaperKind } from "@/lib/resources";
import styles from "./Booklet.module.css";
import { Bar, BookletHead, Disclaimer, Facts, Points, Section, courseHref, plural, scaleMax } from "./parts";
import { PrintButton } from "./PrintButton";

const KIND_LABELS: Record<PaperKind, string> = {
  endterm: "Endterm",
  midterm: "Midterm",
  resit: "Resit",
  practice: "Practice",
  other: "Other",
};

function orDash(value: number | null): string {
  return value === null ? "–" : String(value);
}

export function ExamBookletView({ exams }: { exams: ExamBooklet }) {
  const papers = exams.basis.papers;
  const years = papers.flatMap((paper) => (paper.year === null ? [] : [paper.year]));
  const span =
    years.length === 0
      ? null
      : Math.min(...years) === Math.max(...years)
        ? String(years[0])
        : `${Math.min(...years)}–${Math.max(...years)}`;
  // Largest share first: the reader wants to know where most points are.
  const weights = [...exams.topicWeights].sort((a, b) => b.share - a.share);
  const types = [...exams.questionTypes].sort((a, b) => b.share - a.share);
  const format = [
    { label: "Mode", value: exams.format.mode },
    { label: "Duration", value: exams.format.duration },
    { label: "Structure", value: exams.format.structure },
    { label: "Grading", value: exams.format.grading },
    { label: "What you may bring", value: exams.format.aids },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

  return (
    <main className={styles.booklet}>
      <BookletHead
        code={exams.course}
        label="Booklet 2"
        title={exams.title}
        lead={exams.available ? "The exam." : "The assessment."}
        other={{ href: `${courseHref(exams.course)}/booklet/knowledge`, label: "What to know" }}
      >
        <p className={styles.summary}>{exams.summary}</p>
        {exams.available ? (
          <Facts
            facts={[
              { value: String(papers.length), label: `${papersNoun(exams)} counted` },
              ...(span ? [{ value: span, label: "years covered" }] : []),
              { value: String(weights.length), label: "topics examined" },
            ]}
          />
        ) : (
          <p className={styles.notice}>
            The archive holds no past papers for this course, so there are no numbers here. This booklet describes
            how the course is assessed.
          </p>
        )}
        <PrintButton />
      </BookletHead>

      <Section title={exams.available ? "The format" : "How it is assessed"}>
        <dl className={styles.format}>
          {format.map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      </Section>

      {exams.available && (
        <>
          <Section title="Where the points are" note="Share of the points per topic">
            <ol className={styles.chart}>
              {weights.map((weight) => (
                <li key={weight.topic} className={styles.chartRow}>
                  <span className={styles.chartName}>
                    {weight.topic}
                    <small>
                      in {weight.appearsIn} of {plural(papers.length, "paper", "papers")}
                    </small>
                  </span>
                  <dl className={styles.bars}>
                    <div>
                      <dt>Exam points</dt>
                      <dd>
                        <Bar
                          series="exam"
                          value={weight.share}
                          max={scaleMax(weights.map((w) => w.share))}
                          label={`${weight.topic}: ${weight.share}% of the exam points`}
                        />
                      </dd>
                    </div>
                  </dl>
                  <p className={styles.asks}>{weight.asks}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Kinds of questions" note="Share of the points per kind">
            <ol className={styles.chart}>
              {types.map((type) => (
                <li key={type.type} className={styles.chartRow}>
                  <span className={styles.chartName}>{type.type}</span>
                  <dl className={styles.bars}>
                    <div>
                      <dt>Exam points</dt>
                      <dd>
                        <Bar
                          series="exam"
                          value={type.share}
                          max={scaleMax(types.map((t) => t.share))}
                          label={`${type.type}: ${type.share}% of the exam points`}
                        />
                      </dd>
                    </div>
                  </dl>
                  <p className={styles.asks}>{type.description}</p>
                </li>
              ))}
            </ol>
          </Section>

          {exams.recurring.length > 0 && (
            <Section title="What comes back">
              <Points items={exams.recurring} />
            </Section>
          )}
        </>
      )}

      {exams.trends.length > 0 && (
        <Section title="What changed over the years">
          <Points items={exams.trends} />
        </Section>
      )}

      <Section title="How to prepare">
        <Points items={exams.strategy} />
      </Section>

      {exams.pitfalls.length > 0 && (
        <Section title="Where points are lost">
          <Points items={exams.pitfalls} />
        </Section>
      )}

      {exams.available && (
        <Section title="The papers counted" note={plural(papers.length, "paper", "papers")}>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">Paper</th>
                  <th scope="col">Kind</th>
                  <th scope="col">Questions</th>
                  <th scope="col">Points</th>
                  <th scope="col">Minutes</th>
                </tr>
              </thead>
              <tbody>
                {papers.map((paper) => (
                  <tr key={paper.name}>
                    <th scope="row">{paper.name}</th>
                    <td>{KIND_LABELS[paper.kind]}</td>
                    <td>{orDash(paper.questions)}</td>
                    <td>{orDash(paper.points)}</td>
                    <td>{orDash(paper.minutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {papers.some((paper) => paper.questions === null || paper.points === null || paper.minutes === null) && (
            <p className={styles.footnote}>A dash means the paper does not state it.</p>
          )}
        </Section>
      )}

      <Disclaimer>
        {exams.basis.note && (
          <p>
            <strong>What this rests on.</strong> {exams.basis.note}
          </p>
        )}
        <p>
          Past papers show what an exam looked like, not what the next one will be. Written for DelftRate as a study
          aid; it is not an official TU Delft document, and the study guide decides how the course is examined.
        </p>
      </Disclaimer>
    </main>
  );
}

// Booklet 2: what the past papers show, and how to prepare. Drawn by hand: ink on a white
// sheet, the diagrams in coloured pencil. A course without past papers (a project) gets
// "the assessment": how it is graded, without numbers and without diagrams.
import { OTHER_TOPIC, papersNoun, type ExamBooklet, type KnowledgeBooklet, type PaperKind } from "@/lib/resources";
import { GREY, pencil } from "./colours";
import { Badge, Bar, Pie, scaleMax } from "./figures";
import { Lines, Rests, Section, Sheet, courseHref, plural } from "./parts";
import styles from "./Sketch.module.css";

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

export function SketchExam({ exams, knowledge }: { exams: ExamBooklet; knowledge: KnowledgeBooklet }) {
  const papers = exams.basis.papers;
  const years = papers.flatMap((paper) => (paper.year === null ? [] : [paper.year]));
  const first = Math.min(...years);
  const last = Math.max(...years);

  // A topic has the number and the colour it has in the knowledge booklet. The circle keeps
  // that order; the list beside it starts with the topic that carries most points. Points
  // that belong to no topic ("Other") are grey and come last in the circle.
  const numbered = exams.topicWeights
    .map((weight) => {
      const index = knowledge.topics.findIndex((topic) => topic.name === weight.topic);
      return index < 0
        ? { ...weight, order: knowledge.topics.length, sign: "+", pencil: GREY }
        : { ...weight, order: index, sign: String(index + 1), pencil: pencil(index) };
    })
    .sort((a, b) => a.order - b.order);
  const weights = [...numbered].sort((a, b) => b.share - a.share);
  const examined = numbered.filter((weight) => weight.topic !== OTHER_TOPIC).length;

  // Kinds of questions get letters, so that they are not taken for topics.
  const types = [...exams.questionTypes]
    .sort((a, b) => b.share - a.share)
    .map((type, index) => ({ ...type, sign: String.fromCharCode(65 + index), pencil: pencil(index) }));

  const format = [
    { label: "How it is taken", value: exams.format.mode },
    { label: "How long", value: exams.format.duration },
    { label: "How it is built", value: exams.format.structure },
    { label: "How it is graded", value: exams.format.grading },
    { label: "What you may bring", value: exams.format.aids },
  ].filter((row): row is { label: string; value: string } => row.value !== null);

  return (
    <Sheet
      code={exams.course}
      title={exams.title}
      about={exams.available ? "the exam" : "the assessment"}
      other={{ href: `${courseHref(exams.course)}/booklet/knowledge`, label: "The what to know booklet" }}
      intro={
        <>
          <p className={styles.lead}>{exams.summary}</p>
          {exams.available ? (
            <p>
              Counted here: {papers.length} {papersNoun(exams)}
              {years.length > 0 && (first === last ? ` from ${first}` : ` from ${first} to ${last}`)}, which examine{" "}
              {plural(examined, "topic", "topics")}.
            </p>
          ) : (
            <p>
              The archive holds no past papers for this course, so there are no numbers here. This booklet describes
              how the course is assessed.
            </p>
          )}
        </>
      }
    >
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
          <Section title="Where the points are">
            <div className={styles.figure}>
              <Pie
                label="Circle diagram of the share of the exam points per topic"
                slices={numbered.map((weight) => ({
                  title: `${weight.topic}: ${weight.share}% of the exam points`,
                  sign: weight.sign,
                  value: weight.share,
                  pencil: weight.pencil,
                }))}
              />
              <ol className={styles.rows}>
                {weights.map((weight) => (
                  <li key={weight.topic} className={styles.row}>
                    <Badge
                      sign={weight.sign}
                      pencil={weight.pencil}
                      label={weight.topic === OTHER_TOPIC ? "No topic" : `Topic ${weight.sign}`}
                    />
                    <div>
                      <div className={styles.rowHead}>
                        <b>{weight.topic}</b>
                        <span>
                          in {weight.appearsIn} of {plural(papers.length, "paper", "papers")}
                        </span>
                      </div>
                      <Bar
                        label={`${weight.topic}: ${weight.share}% of the exam points`}
                        value={weight.share}
                        max={scaleMax(weights.map((w) => w.share))}
                        pencil={weight.pencil}
                        dense
                      />
                      <p className={styles.asks}>{weight.asks}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Section>

          <Section title="Kinds of questions">
            <div className={styles.figure}>
              <Pie
                label="Circle diagram of the share of the exam points per kind of question"
                slices={types.map((type) => ({
                  title: `${type.type}: ${type.share}% of the exam points`,
                  sign: type.sign,
                  value: type.share,
                  pencil: type.pencil,
                }))}
              />
              <ol className={styles.rows}>
                {types.map((type) => (
                  <li key={type.type} className={styles.row}>
                    <Badge sign={type.sign} pencil={type.pencil} label={`Kind ${type.sign}`} />
                    <div>
                      <div className={styles.rowHead}>
                        <b>{type.type}</b>
                      </div>
                      <Bar
                        label={`${type.type}: ${type.share}% of the exam points`}
                        value={type.share}
                        max={scaleMax(types.map((t) => t.share))}
                        pencil={type.pencil}
                        dense
                      />
                      <p className={styles.asks}>{type.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Section>
        </>
      )}

      {exams.recurring.length > 0 && (
        <Section title="What comes back">
          <Lines items={exams.recurring} />
        </Section>
      )}

      {exams.trends.length > 0 && (
        <Section title="What changed over the years">
          <Lines items={exams.trends} />
        </Section>
      )}

      <Section title="How to prepare">
        <Lines items={exams.strategy} sign="arrow" />
      </Section>

      {exams.pitfalls.length > 0 && (
        <Section title="Where points are lost">
          <div className={styles.box}>
            <Lines items={exams.pitfalls} sign="warning" />
          </div>
        </Section>
      )}

      {exams.available && (
        <Section title="The papers counted">
          {/* On a narrow screen each paper is written out as two lines instead of a row. The
              roles keep it a table for a screen reader in that layout too. */}
          <table className={styles.table} role="table">
            <thead role="rowgroup">
              <tr role="row">
                <th scope="col" role="columnheader">
                  Paper
                </th>
                <th scope="col" role="columnheader">
                  Kind
                </th>
                <th scope="col" role="columnheader">
                  Questions
                </th>
                <th scope="col" role="columnheader">
                  Points
                </th>
                <th scope="col" role="columnheader">
                  Minutes
                </th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {papers.map((paper) => (
                <tr key={paper.name} role="row">
                  <th scope="row" role="rowheader">
                    {paper.name}
                  </th>
                  <td role="cell">{KIND_LABELS[paper.kind]}</td>
                  <td role="cell" data-unit="questions">
                    {orDash(paper.questions)}
                  </td>
                  <td role="cell" data-unit="points">
                    {orDash(paper.points)}
                  </td>
                  <td role="cell" data-unit="minutes">
                    {orDash(paper.minutes)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {papers.some((paper) => paper.questions === null || paper.points === null || paper.minutes === null) && (
            <p className={styles.note}>A dash means the paper does not state it.</p>
          )}
        </Section>
      )}

      <Rests>
        {exams.basis.note && <p>{exams.basis.note}</p>}
        {exams.available ? (
          <p>
            Past papers show what an exam looked like, not what the next one will be. Written for DelftRate as a study
            aid; it is not an official TU Delft document, and the study guide decides how the course is examined.
          </p>
        ) : (
          <p>
            Written for DelftRate as a study aid. It is not an official TU Delft document: the study guide and your
            lecturers decide how the course is assessed.
          </p>
        )}
      </Rests>
    </Sheet>
  );
}

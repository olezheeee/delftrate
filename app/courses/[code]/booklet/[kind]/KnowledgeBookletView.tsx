// Booklet 1: what a student should know, topic by topic, with where the time goes.
import {
  HOURS_PER_ECTS,
  OTHER_TOPIC,
  papersNoun,
  topicStatistics,
  type ExamBooklet,
  type Importance,
  type KnowledgeBooklet,
} from "@/lib/resources";
import styles from "./Booklet.module.css";
import { Bar, BookletHead, Disclaimer, Facts, Points, Section, courseHref, plural, scaleMax } from "./parts";
import { PrintButton } from "./PrintButton";

const IMPORTANCE_LABELS: Record<Importance, string> = {
  essential: "Essential",
  important: "Important",
  useful: "Useful",
};

export function KnowledgeBookletView({ knowledge, exams }: { knowledge: KnowledgeBooklet; exams: ExamBooklet }) {
  const statistics = topicStatistics(knowledge, exams);
  const papers = exams.available ? exams.basis.papers.length : 0;
  const hours = knowledge.ects * HOURS_PER_ECTS;
  // Exam points that the exam booklet files under no topic.
  const outside = exams.available && exams.topicWeights.some((weight) => weight.topic === OTHER_TOPIC);
  const max = scaleMax(statistics.flatMap((row) => [row.timeShare, row.examShare ?? 0]));
  const byName = new Map(statistics.map((row) => [row.name, row]));

  return (
    <main className={styles.booklet}>
      <BookletHead
        code={knowledge.course}
        label="Booklet 1"
        title={knowledge.title}
        lead="What to know."
        other={{ href: `${courseHref(knowledge.course)}/booklet/exams`, label: papers > 0 ? "The exam" : "The assessment" }}
      >
        <p className={styles.summary}>{knowledge.summary}</p>
        <Facts
          facts={[
            { value: `${knowledge.ects} EC`, label: `${hours} hours of study` },
            { value: String(knowledge.topics.length), label: "topics" },
            { value: String(knowledge.basis.lectures), label: knowledge.basis.lectures === 1 ? "lecture" : "lectures" },
            ...(papers > 0 ? [{ value: String(papers), label: `${papersNoun(exams, papers)} counted` }] : []),
          ]}
        />
        <PrintButton />
      </BookletHead>

      <Section title={papers > 0 ? "Where the time goes" : "Where the lecture time goes"} note="Share per topic">
        {papers > 0 && (
          <ul className={styles.legend} aria-label="Legend">
            <li>
              <i data-series="time" />
              Lecture time
            </li>
            <li>
              <i data-series="exam" />
              Exam points
            </li>
          </ul>
        )}
        <ol className={styles.chart}>
          {statistics.map((row) => (
            <li key={row.name} className={styles.chartRow}>
              <span className={styles.chartName}>
                {row.name}
                <small>{IMPORTANCE_LABELS[row.importance]}</small>
              </span>
              <dl className={styles.bars}>
                <div>
                  <dt>Lecture time</dt>
                  <dd>
                    <Bar
                      series="time"
                      value={row.timeShare}
                      max={max}
                      label={`${row.name}: ${row.timeShare}% of the lecture time`}
                    />
                  </dd>
                </div>
                {row.examShare !== null && (
                  <div>
                    <dt>Exam points</dt>
                    <dd>
                      <Bar
                        series="exam"
                        value={row.examShare}
                        max={max}
                        label={`${row.name}: ${row.examShare}% of the exam points`}
                      />
                    </dd>
                  </div>
                )}
                {row.hours !== null && (
                  <div className={styles.hours}>
                    <dt>Suggested study time</dt>
                    <dd>{row.hours} h</dd>
                  </div>
                )}
              </dl>
            </li>
          ))}
        </ol>
        <p className={styles.footnote}>
          Lecture time is each topic&apos;s share of the lecture material.{" "}
          {papers > 0
            ? `Exam points is its share of the points in ${papers} ${papersNoun(exams)}. The suggested study time divides the course's ${hours} hours (${knowledge.ects} EC of ${HOURS_PER_ECTS} hours) over the topics by the mean of the two shares${outside ? ", leaving out the exam points that belong to no topic" : ""}: a starting point, not a rule.`
            : "There are no past papers to count exam points from, so no study time is suggested: the shares say how the taught sessions are divided, not where the hours of the course go."}
        </p>
      </Section>

      <Section title="Topics" note={plural(knowledge.topics.length, "topic", "topics")}>
        <ol className={styles.topics}>
          {knowledge.topics.map((topic, index) => {
            const row = byName.get(topic.name);
            return (
              <li key={topic.name} className={styles.topic}>
                <div className={styles.topicHead}>
                  <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
                  <h3>{topic.name}</h3>
                  <ul className={styles.chips}>
                    <li data-importance={topic.importance}>{IMPORTANCE_LABELS[topic.importance]}</li>
                    <li>{topic.timeShare}% of lectures</li>
                    {row && row.examShare !== null && <li>{row.examShare}% of exam points</li>}
                  </ul>
                </div>
                {topic.lectures.length > 0 && <p className={styles.lectures}>{topic.lectures.join(" · ")}</p>}
                <div className={styles.columns}>
                  <div>
                    <h4>Know</h4>
                    <Points items={topic.know} />
                  </div>
                  <div>
                    <h4>Be able to</h4>
                    <Points items={topic.do} />
                    {topic.pitfalls.length > 0 && (
                      <>
                        <h4>Watch out</h4>
                        <Points items={topic.pitfalls} />
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      {knowledge.prerequisites.length > 0 && (
        <Section title="Before you start">
          <Points items={knowledge.prerequisites} />
        </Section>
      )}

      {knowledge.practical && (
        <Section title="Practical work">
          <p className={styles.text}>{knowledge.practical}</p>
        </Section>
      )}

      <Section title="How to study it">
        <Points items={knowledge.studyAdvice} />
      </Section>

      <Disclaimer>
        <p>
          <strong>What this rests on.</strong> {knowledge.basis.description}
        </p>
        {knowledge.basis.caveat && <p>{knowledge.basis.caveat}</p>}
        <p>
          Written for DelftRate as a study aid. It is not an official TU Delft document: the study guide and your
          lecturers decide what the course covers and what is examined.
        </p>
      </Disclaimer>
    </main>
  );
}

// Booklet 1: what a student should know, topic by topic, with where the hours go. Drawn by
// hand: ink on a white sheet, the diagrams in coloured pencil.
import {
  HOURS_PER_ECTS,
  OTHER_TOPIC,
  papersNoun,
  topicStatistics,
  type ExamBooklet,
  type Importance,
  type KnowledgeBooklet,
} from "@/lib/resources";
import { pencil } from "./colours";
import { Badge, Bar, Pie, Swatch, scaleMax } from "./figures";
import { Lines, Rests, Section, Sheet, courseHref, plural } from "./parts";
import styles from "./Sketch.module.css";

const IMPORTANCE: Record<Importance, string> = {
  essential: "Essential",
  important: "Important",
  useful: "Useful",
};

export function SketchKnowledge({ knowledge, exams }: { knowledge: KnowledgeBooklet; exams: ExamBooklet }) {
  // With past papers a topic has a share of the exam points and a suggested number of
  // hours. Without them (a project) there is only the lecture time.
  const counted = exams.available;
  const statistics = topicStatistics(knowledge, exams).map((row) => ({
    ...row,
    examShare: row.examShare ?? 0,
    hours: row.hours ?? 0,
  }));
  const papers = exams.basis.papers.length;
  const hours = knowledge.ects * HOURS_PER_ECTS;
  const outside = exams.topicWeights.some((weight) => weight.topic === OTHER_TOPIC);
  const max = scaleMax(statistics.flatMap((row) => [row.timeShare, row.examShare]));

  return (
    <Sheet
      code={knowledge.course}
      title={knowledge.title}
      about="what to know"
      other={{
        href: `${courseHref(knowledge.course)}/booklet/exams`,
        label: counted ? "The exam booklet" : "The assessment booklet",
      }}
      intro={
        <>
          <p className={styles.lead}>{knowledge.summary}</p>
          <p>
            {knowledge.ects} EC is about {hours} hours of study. This booklet covers{" "}
            {plural(knowledge.basis.lectures, "lecture", "lectures")} in {plural(knowledge.topics.length, "topic", "topics")}
            {counted && `, and counts exam points from ${papers} ${papersNoun(exams)}`}.
          </p>
        </>
      }
    >
      <Section title={counted ? `Where the ${hours} hours go` : "Where the lecture time goes"}>
        <div className={styles.figure}>
          <Pie
            label={
              counted
                ? `Circle diagram of the suggested study hours per topic, out of ${hours}`
                : "Circle diagram of the share of the lecture time per topic"
            }
            slices={statistics.map((row, index) => ({
              title: counted
                ? `${row.name}: about ${plural(row.hours, "hour", "hours")}`
                : `${row.name}: ${row.timeShare}% of the lecture time`,
              sign: String(index + 1),
              value: counted ? row.hours : row.timeShare,
              pencil: pencil(index),
            }))}
          />
          <div>
            {counted && (
              <ul className={styles.legend} aria-label="Legend">
                <li>
                  <Swatch dense={false} />
                  Lecture time
                </li>
                <li>
                  <Swatch dense />
                  Exam points
                </li>
              </ul>
            )}
            <ol className={styles.rows}>
              {statistics.map((row, index) => (
                <li key={row.name} className={styles.row}>
                  <Badge sign={String(index + 1)} pencil={pencil(index)} label={`Topic ${index + 1}`} />
                  <div>
                    <div className={styles.rowHead}>
                      <a href={`#topic-${index + 1}`}>{row.name}</a>
                      {counted && <span>about {row.hours} h</span>}
                    </div>
                    <dl className={styles.bars}>
                      <div>
                        <dt>Lectures</dt>
                        <dd>
                          <Bar
                            label={`${row.name}: ${row.timeShare}% of the lecture time`}
                            value={row.timeShare}
                            max={max}
                            pencil={pencil(index)}
                            dense={false}
                          />
                        </dd>
                      </div>
                      {counted && (
                        <div>
                          <dt>Exam</dt>
                          <dd>
                            <Bar
                              label={`${row.name}: ${row.examShare}% of the exam points`}
                              value={row.examShare}
                              max={max}
                              pencil={pencil(index)}
                              dense
                            />
                          </dd>
                        </div>
                      )}
                    </dl>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
        {counted ? (
          <p className={styles.note}>
            The circle divides the {hours} hours ({knowledge.ects} EC of {HOURS_PER_ECTS} hours) over the topics. A
            topic&apos;s part is the mean of two shares: its share of the lecture material, and its share of the points
            in {papers} {papersNoun(exams)}
            {outside ? ", leaving out the exam points that belong to no topic" : ""}. Take it as a starting point.
          </p>
        ) : (
          <p className={styles.note}>
            The circle shows each topic&apos;s share of the lecture material. There are no past papers to count exam
            points from, so no study time is suggested: the shares say how the taught sessions are divided, not where
            the hours of the course go.
          </p>
        )}
      </Section>

      <Section title={`The ${plural(knowledge.topics.length, "topic", "topics")}`}>
        <ol className={styles.topics}>
          {knowledge.topics.map((topic, index) => {
            const row = statistics[index];
            return (
              <li key={topic.name} className={styles.topic} id={`topic-${index + 1}`}>
                <div className={styles.topicHead}>
                  <Badge sign={String(index + 1)} pencil={pencil(index)} label={`Topic ${index + 1}`} />
                  <h3>{topic.name}</h3>
                </div>
                <p className={styles.meta}>
                  {IMPORTANCE[topic.importance]}. {topic.timeShare}% of the lecture time
                  {counted &&
                    `, ${row.examShare}% of the exam points, about ${plural(row.hours, "hour", "hours")} of study`}
                  .
                </p>
                {topic.lectures.length > 0 && <p className={styles.meta}>{topic.lectures.join("; ")}</p>}
                <div className={styles.columns}>
                  <div>
                    <h4>Know</h4>
                    <Lines items={topic.know} />
                  </div>
                  <div>
                    <h4>Be able to</h4>
                    <Lines items={topic.do} sign="arrow" />
                    {topic.pitfalls.length > 0 && (
                      <div className={styles.box}>
                        <h4>Watch out</h4>
                        <Lines items={topic.pitfalls} sign="warning" />
                      </div>
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
          <Lines items={knowledge.prerequisites} />
        </Section>
      )}

      {knowledge.practical && (
        <Section title="Practical work">
          <p>{knowledge.practical}</p>
        </Section>
      )}

      <Section title="How to study it">
        <Lines items={knowledge.studyAdvice} sign="arrow" />
      </Section>

      <Rests>
        <p>{knowledge.basis.description}</p>
        {knowledge.basis.caveat && <p>{knowledge.basis.caveat}</p>}
        <p>
          Written for DelftRate as a study aid. It is not an official TU Delft document: the study guide and your
          lecturers decide what the course covers and what is examined.
        </p>
      </Rests>
    </Sheet>
  );
}

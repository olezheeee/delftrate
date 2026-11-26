import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { getCourseSheet } from "@/lib/course-sheet-data";
import { papersNoun } from "@/lib/resources";
import { getCourseMaterial } from "@/lib/resources-data";
import { CourseCard } from "./CourseCard";
import styles from "./CourseCard.module.css";

export const metadata: Metadata = { title: "Course — DelftRate" };

export default function CoursePage({ params }: PageProps<"/courses/[code]">) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Delft<em>Rate</em>
        </Link>
      </header>
      {/* Reads the address and the session, so it is rendered per request. */}
      <Suspense fallback={<div className={styles.skeleton} aria-hidden="true" />}>
        <Course params={params} />
      </Suspense>
    </div>
  );
}

async function Course({ params }: { params: PageProps<"/courses/[code]">["params"] }) {
  const { code } = await params;
  await requireUser();
  const found = await getCourseSheet(decodeURIComponent(code));
  if (!found) notFound();
  // The study material is keyed by the course code as the database spells it.
  const material = await getCourseMaterial(found.course.code);
  return (
    <CourseCard
      course={found.course}
      sheet={found.sheet}
      resources={material.resources}
      booklets={{
        knowledge: material.knowledge && {
          topics: material.knowledge.topics.length,
          lectures: material.knowledge.basis.lectures,
        },
        exams: material.exams && {
          papers: material.exams.basis.papers.length,
          noun: papersNoun(material.exams),
        },
      }}
    />
  );
}

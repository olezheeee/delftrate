import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireProfile } from "@/lib/auth/session";
import { getCourseSheet, getOwnRating } from "@/lib/course-sheet-data";
import { ratingLock } from "@/lib/rating";
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

// The code from the address. A broken escape such as "%E0" names no course, so it is the
// not-found page rather than a server error.
function courseCode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    notFound();
  }
}

async function Course({ params }: { params: PageProps<"/courses/[code]">["params"] }) {
  const { code } = await params;
  // The programme decides whether the user may rate, so an account without a profile is
  // sent to finish it first.
  const { user, profile } = await requireProfile();
  const found = await getCourseSheet(courseCode(code));
  if (!found) notFound();
  // The study material is keyed by the course code as the database spells it.
  const [material, ownRating] = await Promise.all([
    getCourseMaterial(found.course.code),
    getOwnRating(found.course.id, user.id),
  ]);
  const lock = ratingLock({
    userProgramme: profile.programme_id,
    courseProgramme: found.course.programme,
    professorCount: found.sheet.professors.length,
  });
  return (
    <CourseCard
      course={found.course}
      sheet={found.sheet}
      ownRating={ownRating}
      lock={lock}
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

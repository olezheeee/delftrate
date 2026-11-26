import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { getCourseSheet } from "@/lib/course-sheet-data";
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
  return <CourseCard course={found.course} sheet={found.sheet} />;
}

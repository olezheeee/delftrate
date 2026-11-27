import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { requireUser } from "@/lib/auth/session";
import { courseExists } from "@/lib/course-sheet-data";
import { getCourseMaterial } from "@/lib/resources-data";
import styles from "./Booklet.module.css";
import { ExamBookletView } from "./ExamBookletView";
import { KnowledgeBookletView } from "./KnowledgeBookletView";

export const metadata: Metadata = { title: "Booklet — DelftRate" };

export default function BookletPage({ params }: PageProps<"/courses/[code]/booklet/[kind]">) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href="/" className={styles.brand}>
          Delft<em>Rate</em>
        </Link>
      </header>
      {/* Reads the address and the session, so it is rendered per request. */}
      <Suspense fallback={<div className={styles.skeleton} aria-hidden="true" />}>
        <Booklet params={params} />
      </Suspense>
    </div>
  );
}

async function Booklet({ params }: { params: PageProps<"/courses/[code]/booklet/[kind]">["params"] }) {
  const { code: rawCode, kind } = await params;
  await requireUser();
  if (kind !== "knowledge" && kind !== "exams") notFound();

  const code = decodeURIComponent(rawCode);
  const [exists, { knowledge, exams }] = await Promise.all([courseExists(code), getCourseMaterial(code)]);
  // A booklet belongs to a course of the site: without the course, its link back leads
  // nowhere. And the two booklets come as a pair: each one links to the other.
  if (!exists || !knowledge || !exams) notFound();

  return kind === "knowledge" ? (
    <KnowledgeBookletView knowledge={knowledge} exams={exams} />
  ) : (
    <ExamBookletView exams={exams} />
  );
}

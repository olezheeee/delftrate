import styles from "./page.module.css";

export default function Home() {
  return (
    <main className={styles.main}>
      <span className="mono">DelftRate · in development</span>
      <h1 className={styles.title}>
        Know your course before the <em>first lecture.</em>
      </h1>
      <p className={styles.lead}>
        The real application is being built here. The approved demonstration is
        index.html at the root of the repository.
      </p>
    </main>
  );
}

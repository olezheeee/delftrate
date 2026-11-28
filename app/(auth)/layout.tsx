import Link from "next/link";
import styles from "@/app/ui/form.module.css";

// The frame around the account forms: the name of the site, then one card.
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={styles.shell}>
      <Link href="/" className={styles.brand}>
        Delft<em>Rate</em>
      </Link>
      <main className={styles.card}>{children}</main>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import styles from "@/app/ui/form.module.css";
import { RegisterForm } from "../forms";

export const metadata: Metadata = { title: "Create an account — DelftRate" };

export default function RegisterPage() {
  return (
    <>
      <span className="mono">New here · step 1 of 2</span>
      <h1 className={styles.title}>
        Create your <em>account.</em>
      </h1>
      <p className={styles.lead}>
        Start with your email address. We send it a code, and with the code you choose your
        password, programme and year.
      </p>
      <RegisterForm />
      <p className={styles.footer}>
        Already have an account? <Link href="/login">Log in</Link>
      </p>
    </>
  );
}

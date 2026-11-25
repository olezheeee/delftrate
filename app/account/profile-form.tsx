"use client";

import { useActionState } from "react";
import { Messages, ProfileFields, SubmitButton, type FormState } from "@/app/ui/form";
import styles from "@/app/ui/form.module.css";
import { completeProfile } from "./actions";

const EMPTY: FormState = {};

export function ProfileForm() {
  const [state, action] = useActionState(completeProfile, EMPTY);
  return (
    <form action={action} className={styles.form}>
      <Messages state={state} />
      <ProfileFields state={state} />
      <SubmitButton pendingLabel="Saving…">Save</SubmitButton>
    </form>
  );
}

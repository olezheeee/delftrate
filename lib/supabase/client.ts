import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// Use in Client Components.
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient(url, key);
}

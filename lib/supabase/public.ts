import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// A Supabase client that carries no session, for data every visitor may read. Because it
// reads no cookies, its results can be cached and shared between visitors.
// Throws when Supabase is not configured.
export function createPublicClient() {
  const { url, key } = supabaseEnv();
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

import { createServerClient } from "@supabase/ssr";
import { io } from "next/cache";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Use in Server Components, Server Actions and Route Handlers.
export async function createClient() {
  const { url, key } = supabaseEnv();
  // Keep what follows out of everything Next.js renders ahead of a visit. This client is
  // for the visitor's session, and checking a session means comparing the login token with
  // the clock. Reading cookies alone does not tell Next.js that: it may still render ahead
  // (for a link the browser is about to follow), and it then reports the clock being read
  // ("unstable value Date.now() while prerendering"). io() is what the Next.js docs give
  // for this; during a real request it returns at once.
  await io();
  const cookieStore = await cookies();
  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components cannot write cookies. That is fine: the proxy
          // (proxy.ts) refreshes the session before a page is rendered.
        }
      },
    },
  });
}

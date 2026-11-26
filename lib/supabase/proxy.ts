import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isAuthPath, isPublicPath, SIGNED_IN_HOME } from "@/lib/auth/routes";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Runs before every page request (see proxy.ts). It does two things:
//   1. keeps the user signed in: an expired access token is renewed here and the new
//      cookies are passed on to both the page and the browser
//   2. sends signed-out visitors to the login page for everything that is not public
// This is the first line of defence only. Pages and actions check the user again, and the
// database rules decide what can be read.
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let response = NextResponse.next({ request });
  const { url, key } = supabaseEnv();

  const supabase = createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Tells caches in between not to store a response that carries session cookies.
        for (const [name, value] of Object.entries(headers ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });

  // Nothing may run between creating the client and this call: it is what renews the
  // session. It also verifies the token, so `signedIn` cannot be faked with a made-up cookie.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;
  // Only page views are redirected. A form submitted to a page goes on to its action,
  // which checks the user itself and answers in the way the browser side expects; a
  // redirect from here would show up there as a crash.
  if (request.method !== "GET" && request.method !== "HEAD") return response;

  if (!signedIn && !isPublicPath(pathname)) {
    const login = request.nextUrl.clone();
    login.pathname = "/login";
    login.search = "";
    login.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(login, response);
  }

  if (signedIn && isAuthPath(pathname)) {
    const home = request.nextUrl.clone();
    home.pathname = SIGNED_IN_HOME;
    home.search = "";
    return redirectKeepingCookies(home, response);
  }

  return response;
}

// A redirect is a new response; without this the renewed session cookies would be lost.
function redirectKeepingCookies(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(name);
    if (value) redirect.headers.set(name, value);
  }
  return redirect;
}

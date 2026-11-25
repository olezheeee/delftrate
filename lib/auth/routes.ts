// Which pages are open to whom. Used by the proxy and by the sign-in forms.

// Where a user lands after signing in when no other page was asked for.
export const SIGNED_IN_HOME = "/account";

// Pages that exist to get an account or a session. A signed-in user has no use for them.
const AUTH_PATHS = ["/login", "/register", "/verify", "/forgot-password", "/reset-password"];

// Everything else needs a session. A new page is protected until it is added here.
const PUBLIC_PATHS = ["/", ...AUTH_PATHS];

export function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.includes(stripTrailingSlash(pathname));
}

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.includes(stripTrailingSlash(pathname));
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

// The page to return to after signing in comes from the address bar, so it is not trusted:
// only a path inside this site is accepted. Anything else becomes the default.
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string") return SIGNED_IN_HOME;
  // One leading slash, then no slash or backslash: "//host" and "/\host" leave the site.
  if (!/^\/(?![/\\])/.test(next)) return SIGNED_IN_HOME;
  if (/[\u0000-\u001f\\]/.test(next)) return SIGNED_IN_HOME;
  const pathname = next.split(/[?#]/)[0];
  if (isAuthPath(pathname)) return SIGNED_IN_HOME;
  return next;
}

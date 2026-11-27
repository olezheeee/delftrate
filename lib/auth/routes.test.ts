import { describe, expect, it } from "vitest";
import { isAuthPath, isPublicPath, safeNextPath, SIGNED_IN_HOME } from "./routes";

describe("public pages", () => {
  it("are the landing page and the account forms", () => {
    for (const path of ["/", "/login", "/register", "/verify", "/forgot-password", "/reset-password", "/login/"]) {
      expect(isPublicPath(path), path).toBe(true);
    }
  });

  it("everything else needs a session, including pages that do not exist yet", () => {
    for (const path of ["/account", "/courses", "/courses/CSE1100", "/admin", "/login/extra", "/loginx", "/Login", "/api/anything"]) {
      expect(isPublicPath(path), path).toBe(false);
    }
  });

  it("the landing page is public but is not an account form", () => {
    expect(isAuthPath("/")).toBe(false);
    expect(isAuthPath("/login")).toBe(true);
    expect(isAuthPath("/account")).toBe(false);
  });
});

describe("the page to return to after signing in", () => {
  it("keeps a path inside the site, with its query", () => {
    expect(safeNextPath("/courses/CSE1100?tab=professor")).toBe("/courses/CSE1100?tab=professor");
    expect(safeNextPath("/")).toBe("/");
  });

  it.each([
    undefined,
    null,
    "",
    42,
    ["/courses"],
    "courses",
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/courses\\..\\x",
    "/\t/evil.example",
    "javascript:alert(1)",
    " /courses",
  ])("falls back to the default for %j", (next) => {
    expect(safeNextPath(next)).toBe(SIGNED_IN_HOME);
  });

  it("does not send a signed-in user back to an account form", () => {
    expect(safeNextPath("/login")).toBe(SIGNED_IN_HOME);
    expect(safeNextPath("/login?next=/login")).toBe(SIGNED_IN_HOME);
    expect(safeNextPath("/register#top")).toBe(SIGNED_IN_HOME);
  });
});

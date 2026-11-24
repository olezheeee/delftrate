import { afterEach, describe, expect, it, vi } from "vitest";
import { supabaseEnv } from "./env";

afterEach(() => vi.unstubAllEnvs());

describe("supabaseEnv", () => {
  it("returns the URL and key when both are set", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_x");
    expect(supabaseEnv()).toEqual({
      url: "https://example.supabase.co",
      key: "sb_publishable_x",
    });
  });

  it("explains what to do when the settings are missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");
    expect(() => supabaseEnv()).toThrow(/\.env\.example/);
  });
});

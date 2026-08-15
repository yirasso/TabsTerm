import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The module reads the environment once, at import, so each case has to stub
 * the variables and then import it fresh — a plain import would answer with
 * whatever the first test in the file happened to set.
 */
async function loadWith(url: string | undefined, anonKey: string | undefined) {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", url);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", anonKey);
  vi.resetModules();
  return import("./config");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("supabase config", () => {
  it("is absent when neither variable is set, so the app runs without accounts", async () => {
    // This is the case that matters most: a clean clone and the e2e suite both
    // run here, and `src/lib/env.ts` throwing on boot would take them with it.
    const { supabaseConfig, hasAccounts } = await loadWith(undefined, undefined);

    expect(supabaseConfig).toBeNull();
    expect(hasAccounts).toBe(false);
  });

  it("is present when both are set", async () => {
    const { supabaseConfig, hasAccounts } = await loadWith("https://ref.supabase.co", "anon-key");

    expect(supabaseConfig).toEqual({ url: "https://ref.supabase.co", anonKey: "anon-key" });
    expect(hasAccounts).toBe(true);
  });

  it("throws when only one is set, rather than quietly running without accounts", async () => {
    // Falling back here would run a deployment whose operator believes it has
    // accounts, with everyone's tabs going into a browser instead.
    await expect(loadWith("https://ref.supabase.co", undefined)).rejects.toThrow(
      /half-configured/i,
    );
    await expect(loadWith(undefined, "anon-key")).rejects.toThrow(/half-configured/i);
  });

  it("throws when the url is not a url", async () => {
    await expect(loadWith("ref.supabase.co", "anon-key")).rejects.toThrow(/half-configured/i);
  });
});

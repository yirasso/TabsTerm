import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3000);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  /**
   * On CI, both: `github` annotates the failing line in the diff, `html` writes
   * the report the workflow uploads. The annotation says what broke; the report
   * carries the trace of the retry, which is the only way to see a flake after
   * the runner is gone.
   */
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: baseURL,
    // Never reuse: a server already running with the default providers would
    // make these assertions depend on live third-party results.
    reuseExistingServer: false,
    timeout: 120_000,
    /**
     * Pin to the in-repo library so e2e is deterministic and works offline.
     *
     * The Supabase pair is pinned *empty* for the same reason. Whoever runs
     * this may have accounts configured in `.env.local`, and the suite would
     * then quietly test a different app than it does on a clean clone — and
     * reach a real server while doing it. Empty is a configuration the app
     * understands: no accounts, tabs in the browser.
     *
     * `E2E_ACCOUNTS=1` lets `.env.local` through, for running against a real
     * project on purpose. Nothing in the committed suite depends on it: the
     * sign-in itself cannot be driven headlessly through Google's consent
     * screen, and pretending otherwise would be a test that only ever passed.
     */
    env:
      process.env.E2E_ACCOUNTS === "1"
        ? { TAB_PROVIDERS: "local" }
        : {
            TAB_PROVIDERS: "local",
            NEXT_PUBLIC_SUPABASE_URL: "",
            NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
          },
  },
});

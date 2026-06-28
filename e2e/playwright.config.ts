import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E configuration.
 *
 * What Playwright is:
 *   An end-to-end test framework by Microsoft. It controls a real browser
 *   (Chromium, Firefox, WebKit) and tests the full user experience — from
 *   clicking buttons to verifying network requests and visual output.
 *
 * Key concepts used here:
 *   projects     — run the same tests in multiple browsers
 *   setup project — runs once before all tests to set up auth state
 *   storageState — saves/loads sessionStorage (MSAL token cache) so tests
 *                  don't need to perform Azure AD login on every spec file
 *
 * Run:
 *   npx playwright test             — all tests, headless
 *   npx playwright test --ui        — interactive UI mode
 *   npx playwright test --debug     — step-through debugger
 */
export default defineConfig({
  testDir: "./tests",

  // Run test files in parallel for speed
  fullyParallel: true,

  // Fail the build if any test.only() is accidentally committed
  forbidOnly: !!process.env.CI,

  // Retry failed tests once in CI (flakiness protection)
  retries: process.env.CI ? 1 : 0,

  // Workers: use all CPUs in CI, 1 locally to keep it predictable
  workers: process.env.CI ? "50%" : 1,

  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  use: {
    // The Next.js dev server
    baseURL: "http://localhost:3000",

    // Record traces only on first retry — open with: npx playwright show-trace
    trace: "on-first-retry",

    // Screenshots on failure
    screenshot: "only-on-failure",

    // Video on first retry
    video: "retain-on-failure",
  },

  projects: [
    // ── Auth setup — runs once, saves MSAL session to a file ──────────────
    // Other projects depend on this running first.
    {
      name: "setup",
      testMatch: /.*auth\.setup\.ts/,
    },

    // ── Tests that require login (use saved auth state) ──────────────────
    {
      name: "chromium-authenticated",
      use: {
        ...devices["Desktop Chrome"],
        // Playwright injects this sessionStorage into the browser before each test.
        // It contains a mock MSAL token cache — no real Azure AD login needed.
        storageState: "e2e/fixtures/auth-state.json",
      },
      dependencies: ["setup"],
      testIgnore: /public-page/,
    },

    // ── Tests that do NOT require login ───────────────────────────────────
    {
      name: "chromium-public",
      use: { ...devices["Desktop Chrome"] },
      testMatch: /public-page/,
    },
  ],

  // Start the Next.js dev server automatically before running tests.
  // Comment this out if you start the server manually.
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

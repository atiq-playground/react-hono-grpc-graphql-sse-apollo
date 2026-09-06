import { defineConfig, devices } from "@playwright/test";

const dashboardPort = Number(process.env.PLAYWRIGHT_DASHBOARD_PORT ?? 4200);
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${dashboardPort}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // CI starts Vite cold; lazy route chunks can exceed the 5s default expect window.
  expect: { timeout: process.env.CI ? 15_000 : 5_000 },
  timeout: process.env.CI ? 90_000 : 30_000,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "off",
    actionTimeout: process.env.CI ? 15_000 : 0,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium-narrow",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 375, height: 812 },
        hasTouch: true,
      },
    },
  ],
  webServer: {
    command: `bunx nx serve dashboard -- --host 127.0.0.1 --port ${dashboardPort}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // T15: no specs yet; Playwright exits cleanly with zero tests.
  // Keep testMatch so later e2e specs are discovered without config churn.
  testMatch: "**/*.{spec,test}.{ts,tsx,js}",
});

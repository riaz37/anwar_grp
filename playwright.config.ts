import { defineConfig, devices } from "@playwright/test";

// Local dev DB has been retired — this now runs against whatever
// DATABASE_URL is in `.env` (the cloud Supabase project). The seeded
// flow in e2e/agentic-pmo-flow.spec.ts mutates real rows (removes
// stakeholders, adds a risk); do not run this against a shared/production
// database without accepting that.
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: process.env as Record<string, string>,
  },
});

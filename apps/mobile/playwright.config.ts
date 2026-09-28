// End-to-end tests for the app running on Expo web (phone-sized viewport).
// Run from apps/mobile:  npm run test:e2e
// Starts `expo start --web` itself (or reuses one already on the port) and
// talks to the real Supabase project configured in .env — tests only READ
// public data and never sign in, post or send anything.
import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.E2E_PORT ?? 8099);

export default defineConfig({
  testDir: "./e2e",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],
  outputDir: "e2e-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices["Pixel 7"],
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: `npx expo start --web --port ${PORT}`,
    env: { CI: "1" },
    url: `http://localhost:${PORT}`,
    reuseExistingServer: true,
    timeout: 240_000,
    stdout: "ignore",
    stderr: "pipe",
  },
});

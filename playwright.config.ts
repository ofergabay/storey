import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: "http://localhost:3000",
    locale: "he-IL",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    {
      name: "desktop",
      testIgnore: /(?:journey|mobile)\.spec\.ts/,
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: "mobile",
      testMatch: /mobile\.spec\.ts/,
      use: { viewport: { width: 390, height: 844 } },
    },
    {
      name: "journey",
      testMatch: /journey\.spec\.ts/,
      fullyParallel: false,
      use: { viewport: { width: 1280, height: 800 } },
    },
  ],
});

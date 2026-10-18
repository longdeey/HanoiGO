import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "*.spec.ts",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: "http://localhost:3000",
    ...devices[process.env.CI ? "Desktop Safari" : "Desktop Chrome"],
    ...(process.env.CI || process.env.HANOIGO_BROWSER_CHANNEL !== "msedge" ? {} : {
      channel: "msedge" as const,
    }),
    // HANOIGO_REDUCED_MOTION=1 runs the same flows with prefers-reduced-motion.
    ...(process.env.HANOIGO_REDUCED_MOTION ? { contextOptions: { reducedMotion: "reduce" as const } } : {}),
  },
  webServer: [
    {
      command: process.env.HANOIGO_BACKEND_COMMAND ?? "../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: "../../backend",
      url: "http://127.0.0.1:8000/api/v1/ready",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run start -- -p 3000",
      cwd: "..",
      url: "http://localhost:3000",
      reuseExistingServer: true,
      timeout: 60_000,
    },
  ],
});

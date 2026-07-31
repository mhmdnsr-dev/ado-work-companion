import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3456);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Smoke e2e — Chromium only. Starts Next.js when no server is already running.
 * Requires ADO_SESSION_SECRET (≥32 chars); falls back to a local test secret.
 *
 * `process.env.CI` is set automatically by CI systems (e.g. GitHub Actions sets
 * `CI=true`). Locally it is unset. When truthy, Playwright runs in stricter mode:
 * forbids leftover `test.only`, retries once, uses one worker, GitHub reporter,
 * and always starts a fresh webServer (never reuses an existing one).
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 60_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
    serviceWorkers: 'block',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    // Use production server so e2e does not fight the Next.js "one next dev" lock.
    command: `npm run build && npx next start --hostname 127.0.0.1 --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 300_000,
    env: {
      ...process.env,
      ADO_SESSION_SECRET:
        process.env.ADO_SESSION_SECRET?.trim() ||
        'e2e-local-ado-session-secret-32chars-min',
    },
  },
});

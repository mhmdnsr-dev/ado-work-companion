import { defineConfig, devices } from '@playwright/test';

const PORT = Number(process.env.E2E_PORT ?? 3456);
const baseURL = `http://127.0.0.1:${PORT}`;

/**
 * Smoke e2e — Chromium only. Starts Next.js when no server is already running.
 * Requires ADO_SESSION_SECRET (≥32 chars); falls back to a local test secret.
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

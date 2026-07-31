import { expect, test } from '@playwright/test';

test.describe('configuration gate', () => {
  test('unconfigured visitors land on /configure', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/configure$/, { timeout: 30_000 });
    await expect(page.getByText('Connect your organization')).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Organization$/i })).toBeVisible();
  });

  test('dashboard requires configuration and redirects', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/configure$/, { timeout: 30_000 });
    await expect(page.getByText('Connect your organization')).toBeVisible();
  });

  test('offline shell is reachable without a PAT session', async ({ page }) => {
    await page.goto('/offline');
    await expect(
      page.getByRole('heading', { name: /You’re offline|You're offline/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Try again/i })).toBeVisible();
  });
});

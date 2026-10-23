import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('dashboard defaults and layout', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
  });

  test('selects the first team and current member without extra cards', async ({
    page,
  }) => {
    await configureMockConnection(page);
    await page.goto('/dashboard');

    await expect(page.locator('#dashboard-team')).toContainText('Team Alpha', {
      timeout: 20_000,
    });
    await expect(page.locator('#dashboard-member')).toContainText('Me (Alex Doe)', {
      timeout: 20_000,
    });

    const main = page.locator('#main-content');
    await expect(main.getByRole('button', { name: 'Test connection' })).toBeVisible();
    await expect(main.getByText('contoso', { exact: true })).toBeVisible();
    await expect(main.getByText('Mock Project', { exact: true })).toBeVisible();
    await expect(page.getByText('Quick Actions', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/api version/i)).toHaveCount(0);
    await expect(page.getByText(/personal access token/i)).toHaveCount(0);

    const favorites = page.locator('details').filter({ hasText: 'Manage favorites' });
    await expect(favorites).not.toHaveAttribute('open', '');
    await page.getByText('Manage favorites', { exact: true }).click();
    await expect(favorites).toHaveAttribute('open', '');
  });

  test('settings selects the first project when none is saved', async ({ page }) => {
    await configureMockConnection(page, { project: '' });
    await page.goto('/settings');

    await expect(page.locator('#project-combobox')).toContainText('Alpha Project', {
      timeout: 20_000,
    });
    await page.locator('#project-combobox').click();
    await expect(page.getByRole('option', { name: 'Alpha Project' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    await expect(page.getByRole('option', { name: 'Beta Project' })).toBeVisible();
  });
});

for (const width of [320, 390, 430]) {
  test.describe(`mobile toasts at ${width}px`, () => {
    test.use({ viewport: { width, height: 844 } });

    test('stays between the sticky header and the bottom navigation', async ({
      page,
    }) => {
      await installAdoMocks(page);
      await configureMockConnection(page);
      await page.goto('/dashboard');

      await page.getByText('Manage favorites', { exact: true }).click();
      await page.getByRole('button', { name: 'Add Help & About to favorites' }).click();
      await expect(page.getByText('Added to favorites', { exact: true })).toBeVisible();

      // Let the enter animation settle before measuring the toast.
      await page.waitForTimeout(700);

      const header = page.locator('header').filter({ hasText: 'Dashboard' }).first();
      const nav = page.getByRole('navigation', { name: 'Primary' });
      const toast = page.locator('[data-sonner-toast]').first();

      const [headerBox, navBox, toastBox] = await Promise.all([
        header.boundingBox(),
        nav.boundingBox(),
        toast.boundingBox(),
      ]);
      expect(headerBox).not.toBeNull();
      expect(navBox).not.toBeNull();
      expect(toastBox).not.toBeNull();

      expect(headerBox!.y).toBeLessThanOrEqual(1);
      expect(toastBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
      expect(toastBox!.y + toastBox!.height).toBeLessThanOrEqual(navBox!.y + 1);
      expect(toastBox!.y).toBeLessThan(844 / 2);

      const hasHorizontalOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(hasHorizontalOverflow).toBe(false);
    });
  });
}

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

    const scope = page.getByRole('button', {
      name: 'Change team and member. Now Team Alpha, Me (Alex Doe)',
    });
    await expect(scope).toBeVisible({ timeout: 20_000 });
    await scope.click();
    const sheet = page.getByRole('dialog', { name: 'Sprint scope' });
    await expect(sheet.locator('#dashboard-team')).toContainText('Team Alpha');
    await expect(sheet.locator('#dashboard-member')).toContainText('Me (Alex Doe)');
    await sheet.getByRole('button', { name: 'Done' }).click();

    await expect(page.getByText('Quick Actions', { exact: true })).toHaveCount(0);
    await expect(page.getByText(/api version/i)).toHaveCount(0);
    await expect(page.getByText(/personal access token/i)).toHaveCount(0);

    const favorites = page.locator('details').filter({ hasText: 'Manage favorites' });
    await expect(favorites).not.toHaveAttribute('open', '');
    await page.getByText('Manage favorites', { exact: true }).click();
    await expect(favorites).toHaveAttribute('open', '');
  });

  test('leads with your sprint numbers and opens your work for quick updates', async ({
    page,
  }) => {
    await configureMockConnection(page);
    await page.goto('/dashboard');

    const summary = page.getByRole('region', { name: 'Your remaining work' });
    await expect(summary).toBeVisible({ timeout: 20_000 });
    // Alex owns Implement search (4h) and Fix login (2h) in the sprint.
    await expect(summary).toContainText('6h');
    await expect(summary).toContainText('Open items2');
    await expect(page.getByRole('meter', { name: 'Sprint time elapsed' })).toBeVisible();

    const open = page.getByRole('region', { name: /Your open work/ });
    await expect(open.getByRole('treeitem')).toHaveCount(2);
    // In-progress work comes first.
    await expect(open.getByRole('treeitem').first()).toHaveAccessibleName(
      /^Task 101: Implement search/,
    );

    await expect(
      page.getByRole('img', { name: 'Not started 1, In progress 1' }),
    ).toBeVisible();

    // The burndown keeps every value reachable without hovering.
    await page.getByText('Show data', { exact: true }).click();
    await expect(
      page.getByRole('table', { name: 'Remaining and ideal work per day' }),
    ).toBeVisible();

    await open.getByRole('treeitem').first().click();
    await expect(page).toHaveURL(/item=101/);
    await expect(page.getByRole('region', { name: 'Quick update' })).toBeVisible();
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
      await page.goto('/work-items');

      await page.getByRole('button', { name: 'Open filters' }).click();
      await page.getByRole('button', { name: 'Save filters' }).click();
      await expect(
        page.getByText('Filters saved for this project', { exact: true }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Show work items' }).click();

      // Let the enter animation settle before measuring the toast.
      await page.waitForTimeout(700);

      const header = page.locator('header').filter({ hasText: 'Work Items' }).first();
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

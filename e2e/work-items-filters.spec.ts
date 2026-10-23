import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('work item search, quick views, and filters', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
    await configureMockConnection(page);
    await page.goto('/work-items');
    await expect(page.getByText('8 work items in 2 groups', { exact: true })).toBeVisible(
      { timeout: 20_000 },
    );
  });

  test('quick views switch the WIQL scope', async ({ page }) => {
    const queries: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/_apis/wit/wiql'))
        queries.push(request.postData() ?? '');
    });
    const views = page.getByRole('group', { name: 'Quick views' });
    await expect(views.getByRole('button', { name: 'Assigned to me' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await views.getByRole('button', { name: 'Following' }).click();
    await expect(views.getByRole('button', { name: 'Following' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(() => queries.some((q) => q.includes('@Follows'))).toBe(true);
    // Following is not limited to the current user.
    expect(queries.find((q) => q.includes('@Follows'))).not.toContain('@Me');

    await views.getByRole('button', { name: 'My activity' }).click();
    await expect
      .poll(() => queries.some((q) => q.includes('@MyRecentActivity')))
      .toBe(true);
  });

  test('applied search and filters show as removable chips', async ({ page }) => {
    const chips = page.getByRole('list', { name: 'Active filters' });
    await expect(chips).toHaveCount(0);

    await page.getByRole('searchbox', { name: 'Search work items' }).fill('search');
    await page.keyboard.press('Enter');
    await expect(
      chips.getByRole('button', { name: 'Remove filter: “search”' }),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Open filters' }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await sheet.locator('#work-items-state').click();
    await page.getByRole('option', { name: 'All' }).click();
    await sheet.getByRole('button', { name: 'Show work items' }).click();

    await expect(
      chips.getByRole('button', { name: 'Remove filter: Status: All' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Open filters, 1 active' }),
    ).toBeVisible();

    await chips.getByRole('button', { name: 'Remove filter: Status: All' }).click();
    await expect(page.getByRole('button', { name: 'Open filters' })).toBeVisible();

    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(chips).toHaveCount(0);
  });
});

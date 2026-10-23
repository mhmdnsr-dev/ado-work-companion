import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('work item quick update', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
    await configureMockConnection(page);
    await page.goto('/work-items?item=101');
  });

  test('logs work and adjusts remaining hours in one tap', async ({ page }) => {
    const sheet = page.getByRole('dialog', { name: 'Implement search' });
    const quick = sheet.getByRole('region', { name: 'Quick update' });
    await expect(quick).toBeVisible({ timeout: 20_000 });
    await expect(quick.getByLabel('Remaining (h)')).toHaveValue('4');

    await quick.getByRole('button', { name: 'Log 2 hours' }).click();
    await expect(page.getByText('Logged 2h on #101 · 2h remaining')).toBeVisible();
    await expect(quick.getByLabel('Remaining (h)')).toHaveValue('2');
    await expect(quick.getByText('Completed (h)').locator('..')).toContainText('2');

    await quick.getByRole('button', { name: 'Increase remaining by 0.5 hours' }).click();
    await quick.getByRole('button', { name: 'Save remaining' }).click();
    await expect(page.getByText('Remaining set to 2.5h')).toBeVisible();
    await expect(quick.getByRole('button', { name: 'Save remaining' })).toHaveCount(0);

    // The list behind the sheet picks up the new hours.
    await sheet.getByRole('button', { name: 'Close work item' }).click();
    await expect(
      page.getByRole('treeitem', { name: /^Task 101: Implement search/ }),
    ).toContainText('2.5');
  });

  test('changes state with one tap and can undo it', async ({ page }) => {
    const quick = page.getByRole('region', { name: 'Quick update' });
    const states = quick.getByRole('group', { name: 'State' });
    await expect(states.getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
      { timeout: 20_000 },
    );

    // Removing an item is too destructive for a one-tap chip.
    await expect(states.getByRole('button', { name: 'Removed' })).toHaveCount(0);

    await states.getByRole('button', { name: 'Resolved' }).click();
    await expect(page.getByText('#101 moved to Resolved')).toBeVisible();
    await expect(states.getByRole('button', { name: 'Resolved' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'Undo' }).click();
    await expect(states.getByRole('button', { name: 'Active' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });
});

import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('work item quick update', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
    await configureMockConnection(page);
    await page.goto('/work-items?item=101');
  });

  test('composes logged hours and saves them in one request', async ({ page }) => {
    const patches: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'PATCH') patches.push(request.postData() ?? '');
    });
    const sheet = page.getByRole('dialog', { name: 'Implement search' });
    const quick = sheet.getByRole('region', { name: 'Quick update' });
    await expect(quick).toBeVisible({ timeout: 20_000 });

    // Chips and the stepper only build the amount; nothing is saved yet.
    await quick.getByRole('button', { name: 'Add 2 hours' }).click();
    await quick.getByRole('button', { name: 'Add 0.5 hours' }).click();
    await expect(quick.getByLabel('Hours to log')).toHaveValue('2.5');
    await expect(
      quick.getByText('Remaining 4 → 1.5h · Completed 0 → 2.5h'),
    ).toBeVisible();
    expect(patches).toHaveLength(0);

    await quick.getByRole('button', { name: 'Log 2.5h' }).click();
    await expect(page.getByText('Logged 2.5h on #101 · 1.5h remaining')).toBeVisible();
    expect(patches).toHaveLength(1);
    expect(patches[0]).toContain('"value":1.5');
    expect(patches[0]).toContain('"value":2.5');
    await expect(quick.getByLabel('Hours to log')).toHaveValue('');

    // The list behind the sheet picks up the new hours.
    await sheet.getByRole('button', { name: 'Close work item' }).click();
    await expect(
      page.getByRole('treeitem', { name: /^Task 101: Implement search/ }),
    ).toContainText('1.5');
  });

  test('adjusts remaining only, leaving completed alone', async ({ page }) => {
    const quick = page.getByRole('region', { name: 'Quick update' });
    await expect(quick).toBeVisible({ timeout: 20_000 });

    await quick.getByRole('button', { name: 'Adjust remaining only' }).click();
    const field = quick.getByLabel('Set remaining to (h)');
    await field.fill('abc');
    await expect(quick.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();

    await field.fill('6');
    await quick.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(page.getByText('Remaining set to 6h')).toBeVisible();
    await expect(quick.getByText('Remaining 6h · Completed 0h')).toBeVisible();
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

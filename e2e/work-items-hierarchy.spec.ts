import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('work item hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
    await configureMockConnection(page);
    await page.goto('/work-items');
    await expect(page.getByText('2 work items', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('groups matched tasks under their stories and expands them', async ({ page }) => {
    await expect(page.locator('#work-items-display')).toContainText('Flat list');
    await expect(page.getByText('Implement search', { exact: true })).toBeVisible();
    await expect(page.getByText('Search experience', { exact: true })).toHaveCount(0);

    await page.locator('#work-items-display').click();
    await page.getByRole('option', { name: 'Grouped by parent' }).click();

    await expect(page.getByText('7 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByText('Search experience', { exact: true })).toBeVisible();
    await expect(page.getByText('Authentication', { exact: true })).toBeVisible();
    await expect(page.getByText('Implement search', { exact: true })).toBeVisible();
    await expect(page.getByText('QA search', { exact: true })).toBeVisible();
    await expect(page.getByText('Write auth tests', { exact: true })).toBeVisible();
    await expect(page.getByText('Token refresh', { exact: true })).toBeVisible();
    await expect(page.getByText('2 children', { exact: true })).toBeVisible();
    await expect(page.getByText('3 children', { exact: true })).toBeVisible();

    const cards = page.locator('[role="button"][aria-label^="Open work item"]');
    await expect(cards).toHaveCount(7);

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(cards).toHaveCount(2);

    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(cards).toHaveCount(7);

    await page.locator('button[aria-label="Collapse children"]').first().click();
    await expect(cards).toHaveCount(5);
    await page.locator('button[aria-label="Expand children"]').first().click();
    await expect(cards).toHaveCount(7);
  });

  test('can hide extra children and persists the saved view', async ({ page }) => {
    await page.locator('#work-items-display').click();
    await page.getByRole('option', { name: 'Grouped by parent' }).click();
    await expect(page.getByText('7 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );

    await page.locator('#work-items-include-children').click();
    await expect(page.getByText('4 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByText('QA search', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Write auth tests', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Token refresh', { exact: true })).toHaveCount(0);
    await expect(page.getByText('1 child', { exact: true })).toHaveCount(2);

    await page.getByRole('button', { name: 'Save filters' }).click();
    await expect(
      page.getByText('Filters saved for this project', { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText('4 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(page.locator('#work-items-display')).toContainText('Grouped by parent');
    await expect(page.locator('#work-items-include-children')).toHaveAttribute(
      'data-state',
      'unchecked',
    );
  });

  test('create dialog defaults to the current user and current sprint', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'New work item' }).first().click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Task' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Alex Doe' })).toBeVisible();
    await expect(dialog.getByRole('combobox', { name: 'Sprint Current' })).toBeVisible();
    await expect(dialog.locator('#create-priority')).toContainText('2 — High');
  });
});

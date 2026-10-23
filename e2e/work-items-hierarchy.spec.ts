import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('work item hierarchy', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
    await configureMockConnection(page);
    await page.goto('/work-items');
    await expect(page.getByText('8 work items in 2 groups', { exact: true })).toBeVisible(
      { timeout: 20_000 },
    );
  });

  test('groups matched tasks under their stories and expands them', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Tree' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('button', { name: 'List' }).click();
    await expect(page.getByText('2 work items', { exact: true })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Implement search', { exact: true })).toBeVisible();
    await expect(page.getByText('Search experience', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Tree' }).click();

    await expect(page.getByText('8 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    for (const title of [
      'Search experience',
      'Authentication',
      'Implement search',
      'QA search',
      'Write auth tests',
      'Token refresh',
    ]) {
      await expect(page.getByText(title, { exact: true })).toBeVisible();
    }

    const rows = page.getByRole('treeitem');
    await expect(rows).toHaveCount(10);
    const search = page.getByRole('treeitem', {
      name: /^User Story 201: Search experience/,
    });
    const auth = page.getByRole('treeitem', { name: /^User Story 202: Authentication/ });
    await expect(search).toHaveAttribute('aria-expanded', 'true');
    await expect(search).toHaveAttribute('aria-level', '1');
    await expect(search).toContainText('0/3');
    await expect(auth).toContainText('0/3');
    await expect(
      page.getByRole('treeitem', { name: /^Task 101: Implement search/ }),
    ).toHaveAttribute('aria-level', '2');

    // The Epic and Feature above "Authentication" are context-only ancestors:
    // they group the story but their other children are never loaded.
    const epic = page.getByRole('treeitem', { name: /^Epic 501: Customer portal/ });
    const feature = page.getByRole('treeitem', { name: /^Feature 401: Sign-in revamp/ });
    await expect(epic).toHaveAttribute('aria-level', '1');
    await expect(feature).toHaveAttribute('aria-level', '2');
    await expect(auth).toHaveAttribute('aria-level', '3');
    await expect(
      page.getByRole('treeitem', { name: /^Bug 102: Fix login/ }),
    ).toHaveAttribute('aria-level', '4');
    await expect(epic).toContainText('Parent of matches');
    await expect(feature).toContainText('Parent of matches');

    // Custom process types use their ADO colour and icon.
    const meeting = page.getByRole('treeitem', {
      name: /^Meetings 304: Search sync meeting/,
    });
    const glyph = meeting.locator('svg.wit-custom-glyph');
    await expect(glyph).toHaveCount(1);
    await expect(glyph).toHaveAttribute('style', /--wit-custom: #cccccc/);

    await page.getByRole('button', { name: 'Collapse all' }).click();
    await expect(rows).toHaveCount(2);
    await expect(search).toHaveAttribute('aria-expanded', 'false');

    await page.getByRole('button', { name: 'Expand all' }).click();
    await expect(rows).toHaveCount(10);

    await search.locator('[data-tree-toggle]').click();
    await expect(rows).toHaveCount(7);
    await search.locator('[data-tree-toggle]').click();
    await expect(rows).toHaveCount(10);
  });

  test('supports tree keyboard navigation and remembers collapsed rows', async ({
    page,
  }) => {
    await page.getByRole('button', { name: 'Tree' }).click();
    const rows = page.getByRole('treeitem');
    await expect(rows).toHaveCount(10, { timeout: 20_000 });

    const search = page.getByRole('treeitem', {
      name: /^User Story 201: Search experience/,
    });
    const implement = page.getByRole('treeitem', { name: /^Task 101: Implement search/ });
    await search.focus();
    await page.keyboard.press('ArrowLeft');
    await expect(search).toHaveAttribute('aria-expanded', 'false');
    await expect(rows).toHaveCount(7);

    await page.keyboard.press('ArrowRight');
    await expect(rows).toHaveCount(10);
    await page.keyboard.press('ArrowRight');
    await expect(implement).toBeFocused();
    await page.keyboard.press('ArrowLeft');
    await expect(search).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/item=201/);
    await page.keyboard.press('Escape');
    await expect(page).not.toHaveURL(/item=201/);

    await search.locator('[data-tree-toggle]').click();
    await expect(rows).toHaveCount(7);
    await page.reload();
    await page.getByRole('button', { name: 'Tree' }).click();
    await expect(page.getByText('8 work items in 2 groups', { exact: true })).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(rows).toHaveCount(7);
  });

  test('can hide extra children and persists the saved view', async ({ page }) => {
    await page.getByRole('button', { name: 'Tree' }).click();
    await expect(page.getByText('8 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );

    await page.locator('#work-items-include-children').click();
    // Without children the stories (and the Epic/Feature above one of them)
    // only group the two matches, so they render as muted context rows.
    await expect(page.getByText('2 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByRole('treeitem')).toHaveCount(6);
    await expect(page.getByText('Parent of matches', { exact: true })).toHaveCount(4);
    await expect(page.getByText('QA search', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Write auth tests', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Token refresh', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Save filters' }).click();
    await expect(
      page.getByText('Filters saved for this project', { exact: true }),
    ).toBeVisible();

    await page.reload();
    await expect(page.getByText('2 work items in 2 groups', { exact: true })).toBeVisible(
      {
        timeout: 20_000,
      },
    );
    await expect(page.getByRole('button', { name: 'Tree' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
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

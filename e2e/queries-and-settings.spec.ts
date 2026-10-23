import { expect, test } from '@playwright/test';

import { configureMockConnection, installAdoMocks } from './support/ado-mocks';

test.describe('queries', () => {
  test.beforeEach(async ({ page }) => {
    await installAdoMocks(page);
    await configureMockConnection(page);
    await page.goto('/queries');
  });

  test('opening a query runs it right away', async ({ page }) => {
    const library = page.getByRole('tree', { name: 'Saved queries' });
    await expect(library.getByRole('button', { name: 'Active bugs' })).toBeVisible({
      timeout: 20_000,
    });

    // Nested folders expand in place.
    await library.getByRole('button', { name: 'Expand Sprint' }).click();
    await expect(
      library.getByRole('button', { name: 'Current sprint tasks' }),
    ).toBeVisible();

    await library.getByRole('button', { name: 'Active bugs' }).click();
    await expect(page).toHaveURL(/query=q-active-bugs/);
    const details = page.getByRole('region', { name: 'Query details' });
    await expect(details.getByRole('heading', { name: 'Active bugs' })).toBeVisible();
    // No Run button to press: results are already there.
    await expect(details.getByRole('treeitem')).toHaveCount(2, { timeout: 20_000 });
    await expect(details.getByText('2 work items')).toBeVisible();

    await details.getByText('Show WIQL').click();
    await expect(details.getByText(/\[System\.WorkItemType\] = 'Bug'/)).toBeVisible();
  });

  test('search shows where each query lives', async ({ page }) => {
    await page.getByRole('searchbox', { name: 'Search saved queries' }).fill('sprint');
    const matches = page.getByRole('list', { name: 'Matching queries' });
    await expect(
      matches.getByRole('button', { name: /Current sprint tasks/ }),
    ).toContainText('Shared Queries/Sprint/Current sprint tasks');

    await page.getByRole('searchbox', { name: 'Search saved queries' }).fill('zzz');
    await expect(page.getByText('No queries match')).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(page.getByRole('tree', { name: 'Saved queries' })).toBeVisible();
  });
});

test('settings theme is a one-row segmented control', async ({ page }) => {
  await installAdoMocks(page);
  await configureMockConnection(page);
  await page.goto('/settings');

  const theme = page.getByRole('radiogroup', { name: 'Appearance' });
  await theme.getByRole('radio', { name: 'Dark' }).click();
  await expect(theme.getByRole('radio', { name: 'Dark' })).toHaveAttribute(
    'aria-checked',
    'true',
  );
  await expect(page.locator('html')).toHaveClass(/dark/);
  await theme.getByRole('radio', { name: 'System' }).click();
});

test('settings shows one project field unless typing is needed', async ({ page }) => {
  await installAdoMocks(page);
  await configureMockConnection(page);
  await page.goto('/settings');

  const manual = page.getByRole('textbox', { name: 'Project name manual entry' });
  // One field: the picker already shows the saved project.
  await expect(page.locator('#project-combobox')).toContainText('Mock Project', {
    timeout: 20_000,
  });
  await expect(manual).toHaveCount(0);

  // Once the list loads without "Mock Project", the text box explains itself.
  await page.getByRole('button', { name: 'Refresh projects' }).click();
  await expect(manual).toHaveValue('Mock Project');

  await page.locator('#project-combobox').click();
  await page.getByRole('option', { name: 'Alpha Project' }).click();
  await expect(manual).toHaveCount(0);

  await page.getByRole('button', { name: 'Type a name instead' }).click();
  await expect(manual).toHaveValue('Alpha Project');

  // The disclosure names what it holds and shows its value.
  const apiVersion = page.locator('summary').filter({ hasText: 'API version' });
  await expect(apiVersion).toContainText('7.2-preview');
});

import { expect, test, type Page } from '@playwright/test';

test.describe('configuration gate', () => {
  test('unconfigured visitors land on /configure', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/configure$/, { timeout: 30_000 });
    await expect(
      page.getByText('Connect so you can work on your tasks', { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: /^Organization$/i })).toBeVisible();
  });

  test('dashboard requires configuration and redirects', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/configure$/, { timeout: 30_000 });
    await expect(
      page.getByText('Connect so you can work on your tasks', { exact: true }),
    ).toBeVisible();
  });

  test('offline shell is reachable without a PAT session', async ({ page }) => {
    await page.goto('/offline');
    await expect(
      page.getByRole('heading', { name: /You’re offline|You're offline/i }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: /Try again/i })).toBeVisible();
  });
});

test.describe('focused product routes', () => {
  test('serves Help & About publicly', async ({ page }) => {
    await page.goto('/help');
    await expect(page.getByRole('heading', { name: 'Help & About' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Daily workflow' })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Contact the author' })).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'About' }).getByRole('link', { name: 'GitHub' }),
    ).toBeVisible();
  });

  test('shows focused settings with advanced API version disclosure', async ({
    page,
  }) => {
    await page.goto('/help');
    await page.evaluate(() => {
      localStorage.setItem('ado.organization', 'contoso');
      localStorage.setItem('ado.apiVersion', '7.2-preview');
    });
    const response = await page.request.post('/api/config', {
      data: { pat: 'test-pat-for-settings', cookieLifetime: '14d' },
    });
    expect(response.ok()).toBe(true);

    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
    await expect(
      page.locator('#main-content').getByText('Connection', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Projects', { exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Load Projects' })).toHaveCount(0);
    await expect(page.getByRole('textbox', { name: 'API Version' })).toBeHidden();
    await page.getByText('Advanced', { exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'API Version' })).toBeVisible();
  });
});

test.describe('native-like phone shell', () => {
  async function configurePhone(page: Page) {
    await page.goto('/help');
    await page.evaluate(() => {
      localStorage.setItem('ado.organization', 'contoso');
      localStorage.setItem('ado.project', 'Mobile Project');
      localStorage.setItem('ado.apiVersion', '7.2-preview');
    });
    const response = await page.request.post('/api/config', {
      data: { pat: 'test-pat-for-mobile-shell', cookieLifetime: '14d' },
    });
    expect(response.ok()).toBe(true);
  }

  for (const viewport of [
    { width: 320, height: 700 },
    { width: 390, height: 844 },
    { width: 430, height: 932 },
    { width: 740, height: 360 },
  ]) {
    test(`keeps phone navigation reachable at ${viewport.width}x${viewport.height}`, async ({
      browser,
    }) => {
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      await configurePhone(page);
      await page.goto('/dashboard');

      const primary = page.getByRole('navigation', { name: 'Primary' });
      await expect(primary).toBeVisible();
      await expect(primary.getByRole('link', { name: 'Dashboard' })).toBeVisible();
      await expect(primary.getByRole('link', { name: 'Work Items' })).toBeVisible();
      await expect(primary.getByRole('link', { name: 'Queries' })).toBeVisible();
      await expect(
        primary.getByRole('button', { name: 'Open more navigation' }),
      ).toBeVisible();

      const box = await primary.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height + 1);
      await context.close();
    });
  }

  test('provides phone More navigation and work item controls', async ({ browser }) => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    await configurePhone(page);
    await page.goto('/dashboard');

    await page.getByRole('button', { name: 'Open more navigation' }).click();
    await expect(page.getByRole('heading', { name: 'More' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Settings' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Help & About' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).click();

    await page
      .getByRole('navigation', { name: 'Primary' })
      .getByRole('link', { name: 'Work Items' })
      .click();
    await expect(page.getByRole('button', { name: 'New work item' })).toBeVisible();
    await page.getByRole('button', { name: 'Open filters' }).click();
    await expect(page.getByRole('heading', { name: 'Filters' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Show work items' })).toBeVisible();
    await page.getByRole('button', { name: 'Show work items' }).click();

    await page.goto('/work-items?item=not-a-number');
    await expect(page.getByText('Invalid work item link')).toBeVisible();
    await context.close();
  });
});

test.describe('PWA installation guidance', () => {
  test('shows Safari installation steps on iPhone', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { value: 'iPhone' });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
    });
    const page = await context.newPage();

    await page.goto('/configure');
    await expect(page.getByRole('region', { name: 'Install app' })).toBeVisible();
    await page.getByRole('button', { name: 'How to install' }).click();
    await expect(
      page.getByRole('heading', { name: /Install ADO Work on your iPhone/i }),
    ).toBeVisible();
    await expect(page.getByText('Add to Home Screen', { exact: false })).toBeVisible();

    await context.close();
  });

  test('guides iPhone Chrome users to Safari', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 CriOS/140.0 Mobile/15E148 Safari/604.1',
      viewport: { width: 390, height: 844 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { value: 'iPhone' });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
      let copyAttempts = 0;
      Object.defineProperty(navigator, 'clipboard', {
        value: {
          writeText: () => {
            copyAttempts += 1;
            return copyAttempts === 1
              ? Promise.resolve()
              : Promise.reject(new Error('Clipboard unavailable'));
          },
        },
      });
    });
    const page = await context.newPage();

    await page.goto('/configure');
    await page.getByRole('button', { name: 'How to install' }).click();
    await expect(page.getByText('First, open this page in Safari')).toBeVisible();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('button', { name: 'Link copied' })).toBeVisible();
    await page.getByRole('button', { name: 'Close' }).first().click();
    await page.getByRole('button', { name: 'How to install' }).click();
    await page.getByRole('button', { name: 'Copy link' }).click();
    await expect(page.getByRole('alert')).toContainText('could not be copied');

    await context.close();
  });

  test('uses the browser-native install prompt when available', async ({ page }) => {
    await page.goto('/configure');
    await page.evaluate(() => {
      const event = new Event('beforeinstallprompt');
      Object.assign(event, {
        platforms: ['web'],
        prompt: () => Promise.resolve(),
        userChoice: Promise.resolve({ outcome: 'accepted' }),
      });
      window.dispatchEvent(event);
    });

    await page.getByRole('button', { name: 'Install', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Install app' })).toHaveCount(0);
  });

  test('keeps a dismissed install banner hidden for the session', async ({ browser }) => {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'platform', { value: 'iPhone' });
      Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 });
    });
    const page = await context.newPage();

    await page.goto('/configure');
    await page.getByRole('button', { name: 'Not now' }).click();
    await page.reload();
    await expect(page.getByRole('region', { name: 'Install app' })).toHaveCount(0);

    await context.close();
  });

  test('hides installation UI in standalone mode', async ({ page }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);
      window.matchMedia = (query: string) => {
        if (query === '(display-mode: standalone)') {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => undefined,
            removeListener: () => undefined,
            addEventListener: () => undefined,
            removeEventListener: () => undefined,
            dispatchEvent: () => true,
          };
        }
        return originalMatchMedia(query);
      };
    });

    await page.goto('/configure');
    await expect(page.getByRole('region', { name: 'Install app' })).toHaveCount(0);
  });
});

import { expect, test } from '@playwright/test';

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

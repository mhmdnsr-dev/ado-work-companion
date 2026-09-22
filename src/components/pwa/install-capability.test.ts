import { describe, expect, it } from 'vitest';

import { detectInstallCapability, type InstallEnvironment } from './install-capability';

const desktopChrome: InstallEnvironment = {
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',
  platform: 'Win32',
  maxTouchPoints: 0,
  standalone: false,
  nativePromptAvailable: false,
};

describe('detectInstallCapability', () => {
  it('prioritizes installed display mode', () => {
    expect(
      detectInstallCapability({
        ...desktopChrome,
        standalone: true,
        nativePromptAvailable: true,
      }),
    ).toBe('installed');
  });

  it('uses a captured native prompt on Chromium platforms', () => {
    expect(
      detectInstallCapability({ ...desktopChrome, nativePromptAvailable: true }),
    ).toBe('native-prompt');
  });

  it('recognizes iPhone Safari as a manual install target', () => {
    expect(
      detectInstallCapability({
        ...desktopChrome,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe('ios-safari-manual');
  });

  it.each(['CriOS', 'FxiOS'])('recognizes %s on iPhone as a Safari handoff', (token) => {
    expect(
      detectInstallCapability({
        ...desktopChrome,
        userAgent: `Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 ${token}/140.0 Mobile/15E148 Safari/604.1`,
        platform: 'iPhone',
        maxTouchPoints: 5,
      }),
    ).toBe('ios-other-browser');
  });

  it('recognizes iPadOS when it reports a desktop platform', () => {
    expect(
      detectInstallCapability({
        ...desktopChrome,
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15',
        platform: 'MacIntel',
        maxTouchPoints: 5,
      }),
    ).toBe('ios-safari-manual');
  });

  it('reports unsupported when no install path is exposed', () => {
    expect(detectInstallCapability(desktopChrome)).toBe('unsupported');
  });
});

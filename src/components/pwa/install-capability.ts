export type InstallCapability =
  | 'installed'
  | 'native-prompt'
  | 'ios-safari-manual'
  | 'ios-other-browser'
  | 'unsupported';

export interface InstallEnvironment {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  standalone: boolean;
  nativePromptAvailable: boolean;
}

function isAppleMobileDevice({
  userAgent,
  platform,
  maxTouchPoints,
}: InstallEnvironment): boolean {
  return (
    /iPad|iPhone|iPod/i.test(userAgent) || (platform === 'MacIntel' && maxTouchPoints > 1)
  );
}

function isSafariBrowser(userAgent: string): boolean {
  return (
    /Safari/i.test(userAgent) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|GSA/i.test(userAgent)
  );
}

export function detectInstallCapability(
  environment: InstallEnvironment,
): InstallCapability {
  if (environment.standalone) return 'installed';
  if (environment.nativePromptAvailable) return 'native-prompt';
  if (!isAppleMobileDevice(environment)) return 'unsupported';
  return isSafariBrowser(environment.userAgent)
    ? 'ios-safari-manual'
    : 'ios-other-browser';
}

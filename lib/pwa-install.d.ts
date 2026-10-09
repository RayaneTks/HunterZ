export function canInstallPwa(event: unknown): boolean;
export function isStandaloneMode(displayMode: string, navigatorStandalone: boolean): boolean;
export function getInstallHelp(options?: {userAgent?: string; maxTouchPoints?: number; standalone?: boolean; hasPrompt?: boolean}): {kind: 'installed'|'prompt'|'ios-help'|'browser-help'|'webview-help'; text: string};

function canInstallPwa(event) {
  return Boolean(event && typeof event.prompt === 'function');
}

function isStandaloneMode(displayMode, navigatorStandalone) {
  return displayMode === 'standalone' || navigatorStandalone === true;
}

module.exports = { canInstallPwa, isStandaloneMode };
function getInstallHelp({ userAgent = '', maxTouchPoints = 0, standalone = false, hasPrompt = false } = {}) {
  if (standalone) return { kind: 'installed', text: 'HUNT est installée.' };
  if (/Instagram|FBAN|FBAV|\bwv\b|Line\/|Twitter/i.test(userAgent)) return { kind: 'webview-help', text: 'Ouvre ce lien dans Safari ou Chrome depuis le menu de cette application, puis ajoute HUNT à ton écran d’accueil.' };
  if (hasPrompt) return { kind: 'prompt', text: 'Ajoute HUNT à ton écran d’accueil.' };
  if (/iPhone|iPad|iPod/i.test(userAgent) || (/Macintosh/i.test(userAgent) && maxTouchPoints > 1)) return { kind: 'ios-help', text: 'Dans Safari, ouvre Partager puis « Sur l’écran d’accueil ». Active « Ouvrir comme app » si proposé.' };
  return { kind: 'browser-help', text: 'Dans le menu de ton navigateur, cherche « Installer » ou « Ajouter à l’écran d’accueil ». Si absent, utilise HUNT directement ici.' };
}
module.exports.getInstallHelp = getInstallHelp;

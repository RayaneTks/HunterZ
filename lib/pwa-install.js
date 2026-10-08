function canInstallPwa(event) {
  return Boolean(event && typeof event.prompt === 'function');
}

function isStandaloneMode(displayMode, navigatorStandalone) {
  return displayMode === 'standalone' || navigatorStandalone === true;
}

module.exports = { canInstallPwa, isStandaloneMode };

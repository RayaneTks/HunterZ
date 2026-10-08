'use client';

import { Download, Share, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { canInstallPwa, isStandaloneMode } from '../lib/pwa-install';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export default function InstallPrompt() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const mode = window.matchMedia('(display-mode: standalone)').matches;
    const iosMode = 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
    setStandalone(isStandaloneMode(mode ? 'standalone' : 'browser', iosMode));
    setIos(/iphone|ipad|ipod/i.test(window.navigator.userAgent));

    const onBeforeInstall = (event: Event) => {
      if (!canInstallPwa(event)) return;
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function install() {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  }

  if (standalone || dismissed || (!installEvent && !ios)) return null;

  return (
    <aside className="install-prompt" aria-label="Installer HUNT">
      <div className="install-icon"><Download size={18} strokeWidth={2.4} /></div>
      <div className="install-copy">
        <strong>Fixer HUNT sur ton terrain</strong>
        <span>{ios ? <>Partager <Share size={13} /> puis « Sur l’écran d’accueil ».</> : 'Retrouve ta chasse en un geste.'}</span>
      </div>
      {installEvent && <button className="button button-small" onClick={() => void install()}>Installer</button>}
      <button className="icon-button" onClick={() => setDismissed(true)} aria-label="Fermer la suggestion"><X size={17} /></button>
    </aside>
  );
}

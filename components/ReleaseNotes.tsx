'use client';

import { Check, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ReleaseEntry = { id: string; title: string; date: string };
type ReleaseInfo = {
  deploymentId: string;
  commit: string;
  title: string;
  builtAt: string;
  target: string;
  url: string | null;
  isVercelDeployment: boolean;
  history: ReleaseEntry[];
};

function readBuildRelease(): ReleaseInfo | null {
  try {
    return JSON.parse(process.env.NEXT_PUBLIC_RELEASE_INFO ?? 'null') as ReleaseInfo | null;
  } catch {
    return null;
  }
}

const buildRelease = readBuildRelease();

export default function ReleaseNotes() {
  const [release, setRelease] = useState<ReleaseInfo | null>(buildRelease);
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [needsReload, setNeedsReload] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!buildRelease?.isVercelDeployment) return;
    try {
      setVisible(window.localStorage.getItem('hunt:last-seen-deployment') !== buildRelease.deploymentId);
    } catch {
      setVisible(true);
    }

    let stopped = false;
    const checkDeployment = async () => {
      try {
        const response = await fetch(`/release.json?check=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok) return;
        const latest = await response.json() as ReleaseInfo;
        if (stopped || !latest.isVercelDeployment || latest.deploymentId === buildRelease.deploymentId) return;
        setRelease(latest);
        setNeedsReload(true);
        setVisible(true);
      } catch {
        // The in-app release label remains available if the version check is offline.
      }
    };
    const interval = window.setInterval(() => void checkDeployment(), 60_000);
    const onFocus = () => void checkDeployment();
    window.addEventListener('focus', onFocus);
    void checkDeployment();
    return () => {
      stopped = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setOpen(false);
      trigger.current?.focus();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  if (!visible || !release?.isVercelDeployment) return null;

  function dismiss() {
    try {
      window.localStorage.setItem('hunt:last-seen-deployment', release!.deploymentId);
    } catch {
      // Keep the confirmation usable when browser storage is blocked.
    }
    setVisible(false);
    setOpen(false);
  }

  const formattedDate = new Date(release.builtAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });
  const shortCommit = release.commit.slice(0, 7);
  return (
    <>
      <aside className="release-notice" aria-live="polite">
        <span className="release-check"><Check size={15} /></span>
        <span className="release-notice-copy"><strong>{needsReload ? 'Version plus récente disponible' : 'Version du build affichée'}</strong><small>{release.title}</small></span>
        <button ref={trigger} className="release-open button button-small" onClick={() => setOpen(true)}>{needsReload ? 'Actualiser' : 'Nouveautés'}</button>
        <button className="icon-button release-dismiss" onClick={dismiss} aria-label="Fermer l’avis de version"><X size={16} /></button>
      </aside>
      {open && <div className="release-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); trigger.current?.focus(); } }}>
        <section className="release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-title">
          <div className="release-dialog-heading"><span className="release-check"><Check size={17} /></span><button ref={closeButton} className="icon-button" onClick={() => { setOpen(false); trigger.current?.focus(); }} aria-label="Fermer"><X size={17} /></button></div>
          <p className="eyebrow">HUNT · NOTES DE VERSION</p>
          <h2 id="release-title">{needsReload ? 'Une nouvelle version est disponible.' : 'Version chargée dans HUNT.'}</h2>
          <p className="release-deploy-status">{needsReload ? 'Le point de vérification des versions Vercel indique un build plus récent.' : `Build Vercel · ${release.target} · ${formattedDate}`}</p>
          <div className="release-current"><strong>{release.title}</strong><small>Commit {shortCommit} · {formattedDate}</small></div>
          <ul className="release-history" aria-label="Historique récent">
            {release.history.slice(0, 8).map((entry) => <li key={entry.id}><span className="rec-dot" /><span>{entry.title}</span><small>{entry.id.slice(0, 7)}</small></li>)}
          </ul>
          <div className="release-dialog-actions">
            {needsReload && <button className="button button-primary" onClick={() => window.location.reload()}><RefreshCw size={15} /> Recharger HUNT</button>}
            <button className="button button-soft" onClick={dismiss}>{needsReload ? 'Plus tard' : 'Compris'}</button>
          </div>
        </section>
      </div>}
    </>
  );
}

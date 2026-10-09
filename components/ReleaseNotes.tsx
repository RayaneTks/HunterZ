'use client';

import { Check, RefreshCw, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

type ReleaseInfo = {
  deploymentId: string;
  releaseTitle: string;
  notes: string[];
  builtAt: string;
  target: string;
  url: string | null;
  isVercelDeployment: boolean;
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
      const unseenRelease = window.localStorage.getItem('hunt:last-seen-deployment') !== buildRelease.deploymentId;
      setVisible(unseenRelease);
      setOpen(unseenRelease);
    } catch {
      setVisible(true);
      setOpen(true);
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
        setOpen(true);
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
  const releaseDate = new Date(release.builtAt).toLocaleDateString('fr-FR', { dateStyle: 'long' });
  return (
    <>
      <aside className="release-notice" aria-live="polite">
        <span className="release-check"><Check size={15} /></span>
        <span className="release-notice-copy"><strong>{needsReload ? 'Une mise à jour est prête' : 'Quoi de neuf dans HUNT ?'}</strong><small>{release.releaseTitle}</small></span>
        <button ref={trigger} className="release-open button button-small" onClick={() => setOpen(true)}>{needsReload ? 'Actualiser' : 'Découvrir'}</button>
        <button className="icon-button release-dismiss" onClick={dismiss} aria-label="Fermer l’avis de version"><X size={16} /></button>
      </aside>
      {open && <div className="release-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setOpen(false); trigger.current?.focus(); } }}>
        <section className="release-dialog" role="dialog" aria-modal="true" aria-labelledby="release-title">
          <div className="release-dialog-heading"><span className="release-check"><Check size={17} /></span><button ref={closeButton} className="icon-button" onClick={() => { setOpen(false); trigger.current?.focus(); }} aria-label="Fermer"><X size={17} /></button></div>
          <p className="eyebrow">HUNT · NOUVEAUTÉS</p>
          <h2 id="release-title">{needsReload ? 'Une mise à jour est prête.' : 'Voici ce qui a changé.'}</h2>
          <p className="release-deploy-status">{needsReload ? 'Les nouveautés sont prêtes. Actualise HUNT pour les découvrir.' : `Build généré le ${releaseDate}.`}</p>
          <div className="release-current"><strong>{release.releaseTitle}</strong><ul className="release-notes" aria-label="Changements apportés">{release.notes.map((note, index) => <li key={`${index}-${note}`}>{note}</li>)}</ul></div>
          <p className="release-status-footnote">{needsReload ? 'Cette mise à jour est prête à être chargée.' : release.target === 'production' ? 'Tu utilises la version actuellement en ligne.' : 'Tu consultes une version de préproduction.'}</p>
          <ul className="release-history" aria-label="Détails de publication">
            <li><span className="rec-dot" /><span>{release.target === 'production' ? 'Version en ligne' : `Version ${release.target}`}</span><small>{formattedDate}</small></li>
          </ul>
          <div className="release-dialog-actions">
            {needsReload && <button className="button button-primary" onClick={() => window.location.reload()}><RefreshCw size={15} /> Recharger HUNT</button>}
            <button className="button button-soft" onClick={() => { if (needsReload) setOpen(false); else dismiss(); }}>{needsReload ? 'Plus tard' : 'Compris'}</button>
          </div>
        </section>
      </div>}
    </>
  );
}

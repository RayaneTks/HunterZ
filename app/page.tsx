'use client';

import dynamic from 'next/dynamic';
import { ArrowRight, Check, ChevronDown, CircleAlert, Copy, Crosshair, LogOut, Radio, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGeolocation } from '../hooks/use-geolocation';
import InstallPrompt from '../components/InstallPrompt';
import { closeRoom, createRoom, ensureAnonymousSession, getProfile, getRoom, joinRoom, leaveRoom, loadLobby, saveProfile } from '../lib/hunt';
import { supabase } from '../lib/supabase';
import type { LobbySnapshot, Room } from '../lib/types';
const { isPositionFresh } = require('../lib/location-freshness.cjs') as { isPositionFresh: (updatedAt: string, nowMs?: number) => boolean };
const { messageFromError } = require('../lib/error-message.cjs') as { messageFromError: (error: unknown) => string };
type ActiveRoomStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const {
  clearActiveRoom,
  createAndActivateRoom,
  joinAndActivateRoom,
  refreshRoomMetadata,
  restoreActiveRoom,
} = require('../lib/active-room.cjs') as {
  clearActiveRoom: (storage: ActiveRoomStorage | null) => void;
  createAndActivateRoom: (create: typeof createRoom, ownerId: string, storage: ActiveRoomStorage | null, setRoom: (room: Room | null) => void) => Promise<Room>;
  joinAndActivateRoom: (code: string, join: typeof joinRoom, storage: ActiveRoomStorage | null, setRoom: (room: Room | null) => void) => Promise<Room>;
  refreshRoomMetadata: (room: Room, getRoomById: typeof getRoom) => Promise<Room>;
  restoreActiveRoom: (storage: ActiveRoomStorage | null, getRoomById: typeof getRoom, setRoom: (room: Room | null) => void, isCurrent?: () => boolean) => Promise<Room | null>;
};

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });
type ErrorScope = 'global' | 'profile' | 'create' | 'join';

function activeRoomStorage(): ActiveRoomStorage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function formatAge(timestamp: number | string | null | undefined) {
  if (timestamp == null || timestamp === '') return 'Aucun signal reçu';
  const value = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  if (!Number.isFinite(value) || value > Date.now()) return 'Horodatage invalide';
  const seconds = Math.floor((Date.now() - value) / 1000);
  if (seconds < 5) return 'À l’instant';
  if (seconds < 60) return `Il y a ${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  return `Il y a ${minutes} min`;
}

function SignalStatus({ state, accuracy, lastUpdate, errorMessage }: { state: ReturnType<typeof useGeolocation>['state']; accuracy: number | null; lastUpdate: number | null; errorMessage: string | null }) {
  const labels = {
    off: 'Balise inactive',
    requesting: 'Recherche du signal',
    active: 'Balise active',
    denied: 'Balise bloquée',
    unavailable: 'Signal indisponible',
  } as const;
  const detail = state === 'active'
    ? `${errorMessage ? `${errorMessage} · ` : ''}${formatAge(lastUpdate)} · ±${accuracy == null ? '—' : Math.round(accuracy)} m`
    : errorMessage ?? (state === 'requesting' ? 'Autorise la localisation dans ton navigateur.' : 'Aucun partage de position en cours.');

  return <div className={`signal-status ${state}`} role="status" aria-live="polite"><span className="signal-status-mark" /><span><strong>{labels[state]}</strong><small>{detail}</small></span></div>;
}

function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopyFailed(true);
    }
  }

  return <div className="copy-control"><button className="button button-ghost button-small" onClick={() => void copy()}><span>{copied ? <Check size={15} /> : <Copy size={15} />}</span><span aria-live="polite">{copied ? 'Copié' : label}</span></button>{copyFailed && <label className="copy-fallback">Copie ce code<input readOnly value={value} aria-label="Code à copier manuellement" onFocus={(event) => event.target.select()} /></label>}</div>;
}

function ActionError({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss: () => void }) {
  return <div className="action-error" role="alert"><CircleAlert size={15} /><span>{message}</span>{onRetry && <button className="button button-ghost button-small action-retry" onClick={onRetry}>Réessayer</button>}<button className="icon-button" onClick={onDismiss} aria-label="Fermer"><X size={15} /></button></div>;
}

function Brand() {
  return <div className="brand-lockup" aria-label="HUNT"><svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M5 5h13v5h-8v8H5zm25 0h13v13h-5v-8h-8zM5 30h5v8h8v5H5zm33 0h5v13H30v-5h8z" /><circle cx="24" cy="24" r="5" fill="#f05a50" /></svg><svg className="brand-name" viewBox="0 0 136 24" aria-hidden="true"><path fill="currentColor" d="M0 0h7v9h14V0h7v24h-7v-9H7v9H0zM36 0h7v17h14V0h7v19q0 5-5 5H41q-5 0-5-5zM73 0h7l15 15V0h7v24h-7L80 9v15h-7zM110 0h26v7h-9v17h-8V7h-9z" /></svg></div>;
}

function CompactUserActions({ nickname, editing, nicknameInput, busy, errorMessage, onEdit, onSave, onCancel, onLogout, onChange }: { nickname: string; editing: boolean; nicknameInput: string; busy: boolean; errorMessage?: string; onEdit: () => void; onSave: () => void; onCancel: () => void; onLogout: () => void; onChange: (value: string) => void }) {
  if (editing) {
    return <div className="profile-editor"><div className="profile-field"><input aria-label="Modifier le pseudo" aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? 'profile-error' : undefined} value={nicknameInput} maxLength={24} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} />{errorMessage && <p id="profile-error" className="profile-error" role="alert">{errorMessage}</p>}</div><button className="button button-small button-primary" onClick={onSave} disabled={busy}>Enregistrer</button><button className="button button-ghost button-small icon-button" onClick={onCancel} aria-label="Annuler"><X size={16} /></button></div>;
  }
  return <details className="user-menu"><summary className="user-menu-trigger"><span className="user-avatar">{nickname.slice(0, 1).toUpperCase()}</span><span>{nickname}</span><span className="user-menu-dots" aria-hidden="true">•••</span></summary><div className="user-menu-popover"><button className="button button-ghost button-small" onClick={onEdit}>Modifier</button><button className="button button-ghost button-small" onClick={onLogout} disabled={busy}><LogOut size={15} /> Déconnexion</button></div></details>;
}

function LoadingScreen() {
  return <main className="app-shell centered"><Brand /><p className="loading-copy">Connexion…</p></main>;
}

export default function Home() {
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [snapshot, setSnapshot] = useState<LobbySnapshot>({ members: [], locations: [] });
  const [joinCode, setJoinCode] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [errorScope, setErrorScope] = useState<ErrorScope>('global');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [squadExpanded, setSquadExpanded] = useState(false);
  const [desktopLobby, setDesktopLobby] = useState(false);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const activeRoomRef = useRef<Room | null>(null);
  activeRoomRef.current = room;

  useEffect(() => {
    setFreshnessNow(Date.now());
  }, [snapshot.locations]);

  useEffect(() => {
    const nextExpiry = snapshot.locations
      .filter((location) => isPositionFresh(location.updated_at, freshnessNow))
      .reduce((next, location) => Math.min(next, Date.parse(location.updated_at) + 45_000), Number.POSITIVE_INFINITY);
    if (!Number.isFinite(nextExpiry)) return;
    const timer = window.setTimeout(() => setFreshnessNow(Date.now()), Math.max(0, nextExpiry - Date.now()));
    return () => window.clearTimeout(timer);
  }, [snapshot.locations, freshnessNow]);

  useEffect(() => {
    const query = window.matchMedia('(min-width: 800px)');
    const update = () => setDesktopLobby(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);

  const gps = useGeolocation(room?.id, userId);

  function clearError() {
    setError('');
    setErrorScope('global');
  }

  function showError(message: string, scope: ErrorScope = 'global') {
    setError(message);
    setErrorScope(scope);
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      if (!supabase) {
        setBooting(false);
        return;
      }
      try {
        const user = await ensureAnonymousSession();
        if (cancelled) return;
        setUserId(user.id);
        const profile = await getProfile(user.id);
        if (profile) {
          setNickname(profile.nickname);
          setNicknameInput(profile.nickname);
        }

        await restoreActiveRoom(activeRoomStorage(), getRoom, (restored) => {
          if (!cancelled && restored) setRoom(restored);
        }, () => !cancelled);
      } catch (bootError) {
        if (!cancelled) showError(messageFromError(bootError));
      } finally {
        if (!cancelled) setBooting(false);
      }
    }
    void boot();
    return () => { cancelled = true; };
  }, []);

  const refreshLobby = useCallback(async () => {
    if (!room) return;
    try {
      setSyncing(true);
      const nextSnapshot = await loadLobby(room);
      if (activeRoomRef.current?.id !== room.id) return;
      if (!nextSnapshot.members.some((member) => member.user_id === userId)) {
        await gps.stop();
        clearActiveRoom(activeRoomStorage());
        setRoom(null);
        setSnapshot({ members: [], locations: [] });
        clearError();
        return;
      }
      setSnapshot(nextSnapshot);
    } catch (loadError) {
      showError(messageFromError(loadError));
    } finally {
      setSyncing(false);
    }
  }, [room, userId, gps.stop]);

  useEffect(() => {
    if (!room || !supabase) return;
    const client = supabase;
    void refreshLobby();
    const channel = client.channel(`lobby-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `room_id=eq.${room.id}` }, refreshLobby)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, refreshLobby)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') showError('Le réseau de la chasse est momentanément indisponible.');
      });
    const fallback = window.setInterval(() => void refreshLobby(), 7000);
    return () => {
      window.clearInterval(fallback);
      void client.removeChannel(channel);
    };
  }, [room, refreshLobby]);

  useEffect(() => {
    if (!room || room.owner_id !== null) return;
    let cancelled = false;
    let refreshing = false;
    const refreshMetadata = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const refreshed = await refreshRoomMetadata(room, getRoom);
        if (!cancelled && refreshed.owner_id !== null) setRoom(refreshed);
      } catch {
        // Keep the recoverable lobby and retry without issuing join_room again.
      } finally {
        refreshing = false;
      }
    };
    void refreshMetadata();
    const retry = window.setInterval(() => void refreshMetadata(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(retry);
    };
  }, [room]);

  useEffect(() => {
    if (!room) return;
    void gps.start();
    return () => { void gps.stop(); };
  }, [room?.id, gps.start, gps.stop]);

  const recentLocations = useMemo(() => snapshot.locations.filter((location) => isPositionFresh(location.updated_at, freshnessNow)), [snapshot.locations, freshnessNow]);
  const activeLocationCount = recentLocations.length;

  async function handleLogin() {
    const value = nicknameInput.trim();
    if (value.length < 2 || value.length > 24) {
      showError('L’indicatif doit contenir entre 2 et 24 caractères.', 'profile');
      return;
    }
    setBusy(true);
    clearError();
    try {
      const id = userId || (await ensureAnonymousSession()).id;
      const profile = await saveProfile(id, value);
      setUserId(id);
      setNickname(profile.nickname);
      setEditingProfile(false);
    } catch (loginError) {
      showError(messageFromError(loginError), 'profile');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    clearError();
    try {
      await createAndActivateRoom(createRoom, userId, activeRoomStorage(), setRoom);
    } catch (createError) {
      showError(messageFromError(createError), 'create');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    clearError();
    try {
      await joinAndActivateRoom(joinCode, joinRoom, activeRoomStorage(), setRoom);
      setJoinCode('');
    } catch (joinError) {
      showError(messageFromError(joinError), 'join');
    } finally {
      setBusy(false);
    }
  }

  async function handleExit() {
    if (!room) return;
    setBusy(true);
    clearError();
    try {
      await gps.stop();
      if (room.owner_id === userId) await closeRoom(room.id);
      else await leaveRoom(room.id);
      clearActiveRoom(activeRoomStorage());
      setRoom(null);
      setSnapshot({ members: [], locations: [] });
    } catch (exitError) {
      showError(messageFromError(exitError));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      if (room) {
        await gps.stop();
        if (room.owner_id === userId) await closeRoom(room.id);
        else await leaveRoom(room.id);
      }
      await supabase?.auth.signOut();
      clearActiveRoom(activeRoomStorage());
      setRoom(null);
      setSnapshot({ members: [], locations: [] });
      setUserId('');
      setNickname('');
      setNicknameInput('');
    } catch (logoutError) {
      showError(messageFromError(logoutError));
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) {
    return <main className="app-shell centered"><Brand /><p className="muted">Connexion au terrain indisponible.</p></main>;
  }

  if (booting) return <LoadingScreen />;

  const sharing = gps.state === 'active' || gps.state === 'requesting';

  return (
    <main className={`app-shell ${room ? 'app-shell-lobby' : ''}`}>
      <header className="app-header">
        <Brand />
        {nickname && <CompactUserActions nickname={nickname} editing={editingProfile} nicknameInput={nicknameInput} busy={busy} errorMessage={errorScope === 'profile' ? error : undefined} onEdit={() => { clearError(); setEditingProfile(true); }} onSave={() => void handleLogin()} onCancel={() => { setNicknameInput(nickname); setEditingProfile(false); clearError(); }} onLogout={() => void handleLogout()} onChange={setNicknameInput} />}
      </header>

      {error && errorScope === 'global' && <div className="alert" role="alert"><CircleAlert size={17} /><span>{error}</span><button className="icon-button" onClick={clearError} aria-label="Fermer"><X size={18} /></button></div>}
      {!room && <InstallPrompt />}

      {!nickname ? (
        <section className="welcome-layout">
          <div className="welcome-copy"><p className="eyebrow"><span className="rec-dot" /> LE TERRAIN, C’EST TA VILLE.</p><h1>La chasse<br />commence ici.</h1><p className="lead-small">Réunis ton escouade.<br />Retrouvez-vous sur le terrain.</p></div>
          <form className="entry-card" onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
            <label className="field-label" htmlFor="nickname">Ton pseudo</label>
            <input id="nickname" placeholder="Comment on t’appelle ?" value={nicknameInput} minLength={2} maxLength={24} required onChange={(event) => setNicknameInput(event.target.value)} autoComplete="nickname" />
            {error && errorScope === 'profile' && <ActionError message={error} onDismiss={clearError} />}
            <button type="submit" className="button button-primary button-wide" disabled={busy}>{busy ? 'Connexion…' : 'Entrer dans HUNT'}<ArrowRight size={18} /></button>
            <p className="privacy-note"><ShieldCheck size={14} /> Ta position se partage uniquement dans ta chasse.</p>
          </form>
        </section>
      ) : !room ? (
        <section className="command-view">
          <div className="page-intro"><p className="greeting">Salut, {nickname}.</p><h1>Choisis<br />une chasse.</h1><p className="lead-small">Ton escouade. Ta ville. Votre terrain.</p></div>
          <div className="command-actions">
            <section className="primary-action">
              <button className="button button-primary button-wide" disabled={busy} onClick={() => void handleCreate()}>{busy ? 'Connexion…' : 'Créer une chasse'}<ArrowRight size={18} /></button>
              {error && errorScope === 'create' && <ActionError message={error} onRetry={() => void handleCreate()} onDismiss={clearError} />}
            </section>
            <form className="join-action" onSubmit={(event) => { event.preventDefault(); if (joinCode.length === 6) void handleJoin(); }}>
              <label className="join-label" htmlFor="join-code">Déjà un code ?</label>
              <div className="join-row"><input id="join-code" placeholder="CODE DE CHASSE" value={joinCode} maxLength={6} minLength={6} required autoComplete="off" autoCapitalize="characters" spellCheck={false} onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} /><button type="submit" className="button button-soft" disabled={busy || joinCode.length !== 6} aria-label="Rejoindre la chasse"><ArrowRight size={20} /></button></div>
              {error && errorScope === 'join' && <ActionError message={error} onRetry={() => void handleJoin()} onDismiss={clearError} />}
            </form>
          </div>
          <p className="privacy-note"><ShieldCheck size={14} /> Terrain privé. Position visible par ton escouade.</p>
          <div className="entry-location"><span className="rec-dot" /> MARSEILLE <span>43.2965° N · 5.3698° E</span></div>
        </section>
      ) : (
        <section className="lobby-view" aria-label="Lobby de la chasse">
          <div className="field-map-shell">
            <MapView key={room.id} locations={recentLocations} me={userId} recenterSignal={recenterSignal} />
            <div className="field-map-header"><div className="room-identity"><p className="eyebrow">CHASSE PRIVÉE</p><h1>{room.code}</h1></div><CopyButton value={room.code} label="Copier le code" /></div>
            <div className="map-live"><span className="rec-dot" /><span>{syncing ? 'Actualisation' : 'En direct'} · {activeLocationCount} balise{activeLocationCount > 1 ? 's' : ''}</span></div>
            {activeLocationCount === 0 && <p className="map-empty-readout">Marseille · En attente des premières positions</p>}
            <button className="map-recenter" onClick={() => setRecenterSignal((value) => value + 1)} aria-label="Centrer sur ma position"><Crosshair size={21} /></button>
          </div>

          <aside className={`squad-sheet ${squadExpanded ? 'expanded' : ''}`} aria-label="Escouade">
            <button className="sheet-toggle" disabled={desktopLobby} onClick={() => setSquadExpanded((value) => !value)} aria-expanded={squadExpanded || desktopLobby} aria-controls="squad-content"><span className="sheet-handle" aria-hidden="true" /><span className="sheet-heading"><span>Escouade <small>{snapshot.members.length}</small></span><ChevronDown size={19} /></span><span className="sr-only">{squadExpanded ? 'Réduire' : 'Développer'} le panneau</span></button>
            <div className="squad-content" id="squad-content">
              <div className="beacon-row"><SignalStatus state={gps.state} accuracy={gps.accuracy} lastUpdate={gps.lastUpdate} errorMessage={gps.errorMessage} /><button className={`beacon-switch ${sharing ? 'active' : ''}`} role="switch" aria-checked={sharing} aria-label="Partager ma position avec l’escouade" onClick={() => void (sharing ? gps.stop() : gps.start())}><span /></button></div>
              <ul className="members">{snapshot.members.map((member) => {
                const location = snapshot.locations.find((item) => item.user_id === member.user_id);
                const fresh = Boolean(location && isPositionFresh(location.updated_at, freshnessNow));
                const own = member.user_id === userId;
                return <li key={member.user_id}><span className={`member-avatar ${own ? 'self' : ''} ${fresh ? 'online' : ''}`}>{(member.profiles?.nickname ?? 'Joueur').slice(0, 1).toUpperCase()}</span><div><strong>{member.profiles?.nickname ?? 'Joueur'}{own && <span className="you-tag">toi</span>}</strong><small>{fresh ? `${formatAge(location?.updated_at)} · ±${location?.accuracy == null ? '—' : Math.round(location.accuracy)} m` : location ? `Dernier signal · ${formatAge(location.updated_at)}` : 'En attente de position'}</small></div><span className={`presence-dot ${fresh ? 'online' : ''} ${own ? 'self' : ''}`} aria-label={fresh ? 'Position récente' : 'Sans position récente'} /></li>;
              })}</ul>
              {snapshot.members.length === 0 && <p className="squad-empty">Connexion à l’escouade…</p>}
              <div className="sheet-details">
                <div className="precision-option"><ShieldCheck size={18} /><span><strong>Localisation précise</strong><small>HUNT demande la meilleure précision disponible. Active « Position exacte » dans les réglages de ton appareil.</small></span></div>
                <p className="precision-note">La précision affichée dépend du GPS et de ton environnement.</p>
                <button className="button button-exit button-wide" disabled={busy} onClick={() => void handleExit()}><LogOut size={16} />{room.owner_id === userId ? 'Fermer la chasse' : 'Quitter la chasse'}</button>
              </div>
            </div>
          </aside>
        </section>
      )}
    </main>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Check, ChevronDown, CircleAlert, Copy, Crosshair, LogOut, MapPin, Radio, Share2, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGeolocation } from '../hooks/use-geolocation';
import InstallPrompt from '../components/InstallPrompt';
import { closeRoom, createRoom, ensureAnonymousSession, getProfile, getRoom, joinRoom, leaveRoom, loadLobby, saveHuntZone, saveProfile } from '../lib/hunt';
import { hapticTap } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import type { HuntZone, LobbySnapshot, Room } from '../lib/types';
import GameModeIdeas from '../components/GameModeIdeas';
const { isPositionFresh } = require('../lib/location-freshness.cjs') as { isPositionFresh: (updatedAt: string, nowMs?: number) => boolean };
const { getZoneState } = require('../lib/zone-state.cjs') as { getZoneState: (location: { latitude: number; longitude: number; accuracy: number | null } | null, zone: HuntZone | null) => 'undefined' | 'no-signal' | 'uncertain' | 'edge' | 'inside' | 'outside' };
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

type ZoneState = ReturnType<typeof getZoneState> | 'stale';

function zoneStateLabel(state: ZoneState) {
  switch (state) {
    case 'inside': return 'Dans le terrain';
    case 'outside': return 'Hors du terrain';
    case 'edge': return 'Près de la limite';
    case 'uncertain': return 'Signal imprécis';
    case 'stale': return 'Signal ancien';
    case 'no-signal': return 'Balise en attente';
    default: return 'Terrain non défini';
  }
}

function zoneStateHint(state: ZoneState) {
  switch (state) {
    case 'inside': return 'Ta position est dans le périmètre choisi.';
    case 'outside': return 'Tu es au-delà du périmètre. Reviens à ton rythme, sans te presser.';
    case 'edge': return 'La précision GPS ne permet pas de confirmer de quel côté tu es.';
    case 'uncertain': return 'La précision GPS est trop faible pour vérifier le périmètre.';
    case 'stale': return 'La dernière position est trop ancienne pour vérifier le périmètre.';
    case 'no-signal': return 'Active ta balise pour vérifier ta position.';
    default: return 'L’hôte peut définir le périmètre de cette chasse.';
  }
}

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
  const nativeApp = Capacitor.isNativePlatform();
  const labels = {
    off: 'Balise inactive',
    requesting: 'Recherche du signal',
    active: 'Balise active',
    denied: 'Balise bloquée',
    unavailable: 'Signal indisponible',
  } as const;
  const detail = state === 'active'
    ? `${errorMessage ? `${errorMessage} · ` : ''}${formatAge(lastUpdate)} · ±${accuracy == null ? '—' : Math.round(accuracy)} m`
    : errorMessage ?? (state === 'requesting'
      ? (nativeApp ? 'Autorise la position précise et garde HUNT ouverte pendant la partie.' : 'Autorise la localisation dans ton navigateur.')
      : (nativeApp ? 'Active le partage de position pour cette partie.' : 'Aucun partage de position en cours.'));

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

function InviteButton({ code }: { code: string }) {
  const [notice, setNotice] = useState('');
  const [copyFallback, setCopyFallback] = useState(false);

  async function share() {
    const url = new URL('/', window.location.origin);
    url.searchParams.set('invite', code);
    const invitationUrl = url.toString();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Rejoins ma chasse HUNT', text: `Rejoins ma chasse privée avec le code ${code}.`, url: invitationUrl });
        setNotice('Lien partagé');
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(invitationUrl);
        setNotice('Lien copié');
      } else {
        setCopyFallback(true);
        return;
      }
      setCopyFallback(false);
      window.setTimeout(() => setNotice(''), 2000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      try {
        await navigator.clipboard.writeText(invitationUrl);
        setNotice('Lien copié');
        setCopyFallback(false);
        window.setTimeout(() => setNotice(''), 2000);
      } catch {
        setCopyFallback(true);
      }
    }
  }

  const url = typeof window === 'undefined' ? '' : new URL(`/?invite=${encodeURIComponent(code)}`, window.location.origin).toString();
  return <div className="invite-control"><button className="button button-ghost button-small invite-button" onClick={() => void share()}><Share2 size={15} /><span aria-live="polite">{notice || 'Inviter'}</span></button>{copyFallback && <label className="copy-fallback invite-fallback">Lien à partager<input readOnly value={url} aria-label="Lien d’invitation à copier" onFocus={(event) => event.target.select()} /></label>}</div>;
}

function ActionError({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss: () => void }) {
  return <div className="action-error" role="alert"><CircleAlert size={15} /><span>{message}</span>{onRetry && <button className="button button-ghost button-small action-retry" onClick={onRetry}>Réessayer</button>}<button className="icon-button" onClick={onDismiss} aria-label="Fermer"><X size={15} /></button></div>;
}

function Brand() {
  return <div className="brand-lockup" aria-label="HUNT"><svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true"><path fill="currentColor" d="M5 5h13v5h-8v8H5zm25 0h13v13h-5v-8h-8zM5 30h5v8h8v5H5zm33 0h5v13H30v-5h8z" /><circle cx="24" cy="24" r="5" fill="#f05a50" /></svg><svg className="brand-name" viewBox="0 0 136 24" aria-hidden="true"><path fill="currentColor" d="M0 0h7v9h14V0h7v24h-7v-9H7v9H0zM36 0h7v17h14V0h7v19q0 5-5 5H41q-5 0-5-5zM73 0h7l15 15V0h7v24h-7L80 9v15h-7zM110 0h26v7h-9v17h-8V7h-9z" /></svg></div>;
}

function CompactUserActions({ nickname, editing, nicknameInput, busy, errorMessage, onEdit, onSave, onCancel, onLogout, onChange }: { nickname: string; editing: boolean; nicknameInput: string; busy: boolean; errorMessage?: string; onEdit: () => void; onSave: () => void; onCancel: () => void; onLogout: () => void; onChange: (value: string) => void }) {
  const menuRef = useRef<HTMLDetailsElement>(null);
  const triggerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    function closeOnOutside(event: PointerEvent) {
      if (menuRef.current?.open && event.target instanceof Node && !menuRef.current.contains(event.target)) menuRef.current.open = false;
    }
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || !menuRef.current?.open) return;
      event.preventDefault();
      menuRef.current.open = false;
      triggerRef.current?.focus();
    }
    document.addEventListener('pointerdown', closeOnOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  if (editing) {
    return <div className="profile-editor"><div className="profile-field"><input aria-label="Modifier le pseudo" aria-invalid={Boolean(errorMessage)} aria-describedby={errorMessage ? 'profile-error' : undefined} value={nicknameInput} maxLength={24} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} />{errorMessage && <p id="profile-error" className="profile-error" role="alert">{errorMessage}</p>}</div><button className="button button-small button-primary" onClick={onSave} disabled={busy}>Enregistrer</button><button className="button button-ghost button-small icon-button" onClick={onCancel} aria-label="Annuler"><X size={16} /></button></div>;
  }
  return <details className="user-menu" ref={menuRef}><summary className="user-menu-trigger" ref={triggerRef as React.RefObject<HTMLElement>}><span className="user-avatar">{nickname.slice(0, 1).toUpperCase()}</span><span>{nickname}</span><span className="user-menu-dots" aria-hidden="true">•••</span></summary><div className="user-menu-popover"><button className="button button-ghost button-small" onClick={onEdit}>Modifier</button><button className="button button-ghost button-small" onClick={onLogout} disabled={busy}><LogOut size={15} /> Déconnexion</button></div></details>;
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
  const [pendingInvite, setPendingInvite] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [errorScope, setErrorScope] = useState<ErrorScope>('global');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);
  const [squadExpanded, setSquadExpanded] = useState(false);
  const [desktopLobby, setDesktopLobby] = useState(false);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState('');
  const [zoneEditing, setZoneEditing] = useState(false);
  const [zonePlacingCenter, setZonePlacingCenter] = useState(false);
  const [zoneDraftCenter, setZoneDraftCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zoneDraftRadius, setZoneDraftRadius] = useState(500);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const sheetTouchStart = useRef<number | null>(null);
  const didSheetSwipe = useRef(false);
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
  const sharedZone = useMemo(() => room?.zone_center_lat != null && room.zone_center_lng != null && room.zone_radius_m != null
    ? { latitude: room.zone_center_lat, longitude: room.zone_center_lng, radiusMeters: room.zone_radius_m }
    : null, [room?.zone_center_lat, room?.zone_center_lng, room?.zone_radius_m]);
  const displayedZone: HuntZone | null = useMemo(() => zoneEditing && zoneDraftCenter
    ? { ...zoneDraftCenter, radiusMeters: zoneDraftRadius }
    : sharedZone, [zoneEditing, zoneDraftCenter, zoneDraftRadius, sharedZone]);
  const ownFreshLocation = snapshot.locations.find((location) => location.user_id === userId && isPositionFresh(location.updated_at, freshnessNow)) ?? null;
  const ownHasStaleSignal = snapshot.locations.some((location) => location.user_id === userId);
  const ownZoneState: ZoneState = sharedZone && !ownFreshLocation && ownHasStaleSignal ? 'stale' : getZoneState(ownFreshLocation, sharedZone);

  useEffect(() => {
    setZoneEditing(false);
    setZonePlacingCenter(false);
    setZoneDraftCenter(null);
    setZoneDraftRadius(500);
    setZoneError('');
  }, [room?.id]);

  function clearError() {
    setError('');
    setErrorScope('global');
  }

  function showError(message: string, scope: ErrorScope = 'global') {
    setError(message);
    setErrorScope(scope);
  }

  function startZoneEditing() {
    if (!room || room.owner_id !== userId) return;
    setZoneError('');
    setZoneDraftCenter(sharedZone ?? (ownFreshLocation ? { latitude: ownFreshLocation.latitude, longitude: ownFreshLocation.longitude } : null));
    setZoneDraftRadius(sharedZone?.radiusMeters ?? 500);
    setZoneEditing(true);
    setZonePlacingCenter(!sharedZone && !ownFreshLocation);
    setActionNotice(sharedZone || ownFreshLocation ? 'Ajuste le centre du terrain sur la carte si besoin.' : 'Touchez la carte pour placer le centre du terrain.');
  }

  function cancelZoneEditing() {
    setZoneEditing(false);
    setZonePlacingCenter(false);
    setZoneDraftCenter(null);
    setZoneError('');
  }

  async function commitZone(center: { latitude: number; longitude: number } | null, radiusMeters: number | null) {
    if (!room || room.owner_id !== userId) return;
    setZoneBusy(true);
    setZoneError('');
    try {
      const updatedRoom = await saveHuntZone(room.id, center, radiusMeters);
      if (!updatedRoom) throw new Error('Le salon n’a pas pu confirmer le terrain.');
      setRoom(updatedRoom);
      setZoneEditing(false);
      setZonePlacingCenter(false);
      setZoneDraftCenter(null);
      setActionNotice(center ? 'Terrain enregistré pour toute l’escouade.' : 'Périmètre retiré.');
      hapticTap();
    } catch (saveError) {
      setZoneError(messageFromError(saveError));
    } finally {
      setZoneBusy(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function boot() {
      const inviteUrl = new URL(window.location.href);
      const inviteCode = inviteUrl.searchParams.get('invite')?.trim().toUpperCase() ?? '';
      if (inviteUrl.searchParams.has('invite')) {
        if (/^[A-Z0-9]{6}$/.test(inviteCode)) {
          setJoinCode(inviteCode);
          setPendingInvite(inviteCode);
        } else {
          showError('Ce lien d’invitation n’est pas valide.');
        }
        inviteUrl.searchParams.delete('invite');
        window.history.replaceState(window.history.state, '', `${inviteUrl.pathname}${inviteUrl.search}${inviteUrl.hash}`);
      }
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
    const refreshRoom = async () => {
      try {
        const currentRoom = await getRoom(room.id);
        if (currentRoom && activeRoomRef.current?.id === room.id) {
          setRoom((previous) => previous && previous.id === currentRoom.id
            && previous.code === currentRoom.code
            && previous.owner_id === currentRoom.owner_id
            && previous.zone_center_lat === currentRoom.zone_center_lat
            && previous.zone_center_lng === currentRoom.zone_center_lng
            && previous.zone_radius_m === currentRoom.zone_radius_m
            && previous.zone_available === currentRoom.zone_available
            ? previous
            : currentRoom);
        }
      } catch {
        // Keep the current lobby snapshot and retry on the next realtime event/poll.
      }
    };
    void refreshLobby();
    const channel = client.channel(`lobby-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `room_id=eq.${room.id}` }, refreshLobby)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, refreshLobby)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` }, refreshRoom)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') showError('Le réseau de la chasse est momentanément indisponible.');
      });
    const fallback = window.setInterval(() => { void refreshLobby(); void refreshRoom(); }, 7000);
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
    if (!room || Capacitor.isNativePlatform()) return;
    void gps.start();
    return () => { void gps.stop(); };
  }, [room?.id, gps.start, gps.stop]);

  const recentLocations = useMemo(() => snapshot.locations.filter((location) => isPositionFresh(location.updated_at, freshnessNow)), [snapshot.locations, freshnessNow]);
  const activeLocationCount = recentLocations.length;

  const selectPlayer = useCallback((playerId: string) => {
    setFocusedPlayerId(playerId);
    const player = recentLocations.find((location) => location.user_id === playerId);
    if (!player) {
      setActionNotice('Aucune position récente pour ce joueur.');
      return;
    }
    setActionNotice(`Carte centrée sur ${player.nickname}.`);
    hapticTap();
  }, [recentLocations]);

  useEffect(() => {
    if (!actionNotice) return;
    const timeout = window.setTimeout(() => setActionNotice(''), 2600);
    return () => window.clearTimeout(timeout);
  }, [actionNotice]);

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

  async function handleJoinCode(code: string) {
    setBusy(true);
    clearError();
    try {
      await joinAndActivateRoom(code, joinRoom, activeRoomStorage(), setRoom);
      setJoinCode('');
    } catch (joinError) {
      showError(messageFromError(joinError), 'join');
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    await handleJoinCode(joinCode);
  }

  useEffect(() => {
    if (!pendingInvite || booting || busy || !nickname || room) return;
    const code = pendingInvite;
    setPendingInvite('');
    void handleJoinCode(code);
  }, [pendingInvite, booting, busy, nickname, room]);

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
          <div className="welcome-copy"><p className="eyebrow"><span className="rec-dot" /> LE TERRAIN, C’EST TA VILLE.</p><h1>La chasse<br />commence ici.</h1><p className="lead-small">Réunis ton escouade.<br />On se retrouve dehors.</p></div>
          <form className="entry-card" aria-busy={busy} onSubmit={(event) => { event.preventDefault(); void handleLogin(); }}>
            <label className="field-label" htmlFor="nickname">Ton pseudo</label>
            {pendingInvite && <p className="invite-context">Invitation à rejoindre la chasse <strong>{pendingInvite}</strong>. Après ton pseudo, tu entreras directement dans le salon.</p>}
            <input id="nickname" placeholder="Comment on t’appelle ?" value={nicknameInput} minLength={2} maxLength={24} required onChange={(event) => setNicknameInput(event.target.value)} autoComplete="nickname" enterKeyHint="go" />
            {error && errorScope === 'profile' && <ActionError message={error} onDismiss={clearError} />}
            <button type="submit" className="button button-primary button-wide" disabled={busy} aria-label={busy ? 'Connexion en cours' : undefined}>{busy ? <><span className="button-spinner" aria-hidden="true" /> Connexion…</> : <>Entrer dans HUNT<ArrowRight size={18} /></>}</button>
            <p className="privacy-note"><ShieldCheck size={14} /> Ta position se partage uniquement dans ta chasse.</p>
          </form>
        </section>
      ) : !room ? (
        <section className="command-view">
          <div className="page-intro"><p className="greeting">Salut, {nickname}.</p><h1>Monte ton<br />escouade.</h1><p className="lead-small">Crée un salon privé ou rejoins ton équipe avec un code.</p></div>
          <div className="command-actions">
            <section className="primary-action">
              <button className="button button-primary button-wide" disabled={busy} aria-busy={busy} onClick={() => { hapticTap(); void handleCreate(); }}>{busy ? <><span className="button-spinner" aria-hidden="true" /> Création…</> : <>Créer un salon<ArrowRight size={18} /></>}</button>
              {error && errorScope === 'create' && <ActionError message={error} onRetry={() => void handleCreate()} onDismiss={clearError} />}
            </section>
            <form className="join-action" onSubmit={(event) => { event.preventDefault(); if (joinCode.length === 6) void handleJoin(); }}>
              <label className="join-label" htmlFor="join-code">Déjà un code ?</label>
              <div className="join-row"><input id="join-code" placeholder="CODE DE CHASSE" value={joinCode} maxLength={6} minLength={6} required autoComplete="off" autoCapitalize="characters" spellCheck={false} enterKeyHint="go" onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} /><button type="submit" className="button button-soft" disabled={busy || joinCode.length !== 6} aria-label={busy ? 'Connexion à la chasse en cours' : 'Rejoindre la chasse'}>{busy ? <span className="button-spinner" aria-hidden="true" /> : <ArrowRight size={20} />}</button></div>
              {error && errorScope === 'join' && <ActionError message={error} onRetry={() => void handleJoin()} onDismiss={clearError} />}
            </form>
          </div>
          <p className="privacy-note"><ShieldCheck size={14} /> Terrain privé. Position visible par ton escouade.</p>
          <div className="entry-location"><span className="rec-dot" /> PRÊT POUR LE TERRAIN <span>Chasse privée</span></div>
        </section>
      ) : (
        <section className="lobby-view" aria-label="Lobby de la chasse">
          <div className="field-map-shell">
            <MapView
              key={room.id}
              locations={recentLocations}
              me={userId}
              recenterSignal={recenterSignal}
              focusedPlayerId={focusedPlayerId}
              onSelectPlayer={selectPlayer}
              zone={displayedZone}
              onMapTap={zoneEditing && zonePlacingCenter ? (center) => {
                setZoneDraftCenter(center);
                setZonePlacingCenter(false);
                setActionNotice('Centre du terrain choisi. Ajuste le rayon puis enregistre.');
                hapticTap();
              } : undefined}
            />
            <div className="field-map-header"><div className="room-identity"><p className="eyebrow">CHASSE PRIVÉE</p><h1>{room.code}</h1></div><div className="room-invite-actions"><InviteButton code={room.code} /><CopyButton value={room.code} label="Copier le code" /></div></div>
            <div className="map-live"><span className="rec-dot" /><span>{syncing ? 'Actualisation' : activeLocationCount ? 'Balises récentes' : 'En attente'} · {activeLocationCount}</span></div>
            <p className="sr-only" role="status" aria-live="polite">{actionNotice}</p>
            {zonePlacingCenter && <div className="map-pick-banner" role="status"><MapPin size={16} /> Touche la carte pour placer le centre du terrain.</div>}
            {sharedZone && <div className={`zone-map-state zone-state-${ownZoneState}`} role="status" aria-live="polite"><MapPin size={17} /><span><strong>{zoneStateLabel(ownZoneState)}</strong><small>{zoneStateHint(ownZoneState)}</small></span></div>}
            {activeLocationCount === 0 && !sharedZone && <p className="map-empty-readout">Active une balise pour apparaître sur la carte.</p>}
            <button className="map-recenter" onClick={() => setRecenterSignal((value) => value + 1)} aria-label="Centrer sur ma position"><Crosshair size={21} /></button>
          </div>

          <aside className={`squad-sheet ${squadExpanded ? 'expanded' : ''}`} aria-label="Escouade">
            <button className="sheet-toggle" disabled={desktopLobby} onTouchStart={(event) => { sheetTouchStart.current = event.touches[0]?.clientY ?? null; didSheetSwipe.current = false; }} onTouchEnd={(event) => { if (desktopLobby || sheetTouchStart.current == null) return; const delta = (event.changedTouches[0]?.clientY ?? sheetTouchStart.current) - sheetTouchStart.current; if (Math.abs(delta) > 48) { didSheetSwipe.current = true; if ((delta < 0) !== squadExpanded) { setSquadExpanded(delta < 0); hapticTap(); } } sheetTouchStart.current = null; }} onClick={() => { if (didSheetSwipe.current) { didSheetSwipe.current = false; return; } setSquadExpanded((value) => !value); hapticTap(); }} aria-expanded={squadExpanded || desktopLobby} aria-controls="squad-content"><span className="sheet-handle" aria-hidden="true" /><span className="sheet-heading"><span>Escouade <small>{snapshot.members.length}</small></span><ChevronDown size={19} /></span><span className="sr-only">{squadExpanded ? 'Réduire' : 'Développer'} le panneau</span></button>
            <div className="squad-content" id="squad-content">
              <div className="beacon-row"><SignalStatus state={gps.state} accuracy={gps.accuracy} lastUpdate={gps.lastUpdate} errorMessage={gps.errorMessage} /><button className={`beacon-switch ${sharing ? 'active' : ''}`} role="switch" aria-checked={sharing} aria-label="Partager ma position avec l’escouade" onClick={() => { if (sharing) void gps.stop(); else void gps.start(); }}><span /></button></div>
              <section className="zone-setup" aria-labelledby="zone-setup-title">
                <div className="lobby-section-heading">
                  <div><p className="lobby-kicker">TERRAIN COMMUN</p><h3 id="zone-setup-title">Zone de jeu</h3></div>
                  <span className={`zone-state-tag ${sharedZone ? 'defined' : ''}`}>{sharedZone ? `${sharedZone.radiusMeters} m` : 'À définir'}</span>
                </div>
                <p className="zone-setup-copy">Un cercle partagé pour vous repérer. La limite n’est pas une barrière réelle et ne remplace pas le choix d’un lieu sûr.</p>
                {sharedZone && <p className="zone-summary"><MapPin size={15} /> Terrain défini par l’hôte · rayon {sharedZone.radiusMeters} m</p>}
                {room.owner_id === userId && room.zone_available !== false && !zoneEditing && <button type="button" className="button button-soft button-wide zone-edit-button" onClick={startZoneEditing}>{sharedZone ? 'Modifier le terrain' : 'Définir le terrain'}<MapPin size={16} /></button>}
                {room.zone_available === false && <p className="zone-migration-note" role="status">Le terrain partagé n’est pas encore activé sur ce salon. Les autres fonctions de la chasse restent disponibles.</p>}
                {room.owner_id !== userId && <p className="zone-setup-copy zone-owner-note">{sharedZone ? 'Le terrain est partagé avec toute l’escouade.' : 'L’hôte n’a pas encore délimité le terrain.'}</p>}
                {zoneEditing && <div className="zone-editor">
                  <p className="zone-editor-label">Rayon du terrain</p>
                  <div className="zone-radius-options" role="group" aria-label="Choisir le rayon de la zone">
                    {[250, 500, 800, 1200].map((radius) => <button key={radius} type="button" className={`zone-radius-option ${zoneDraftRadius === radius ? 'selected' : ''}`} aria-pressed={zoneDraftRadius === radius} onClick={() => setZoneDraftRadius(radius)}>{radius} m</button>)}
                  </div>
                  <button type="button" className="button button-soft button-wide zone-edit-button" onClick={() => { setZonePlacingCenter(true); setActionNotice('Touche la carte pour choisir le centre du terrain.'); }}>{zonePlacingCenter ? 'Choisis le centre sur la carte…' : 'Placer le centre sur la carte'}<MapPin size={16} /></button>
                  {ownFreshLocation && <button type="button" className="button button-ghost button-wide zone-location-button" onClick={() => { setZoneDraftCenter({ latitude: ownFreshLocation.latitude, longitude: ownFreshLocation.longitude }); setZonePlacingCenter(false); setActionNotice('Centre placé sur ta balise. Ajuste le rayon puis enregistre.'); }}>Utiliser ma position actuelle</button>}
                  <p className="zone-center-readout">{zoneDraftCenter ? 'Centre prêt · touche la carte pour le déplacer.' : 'Aucun centre choisi.'}</p>
                  {zoneError && <p className="zone-error" role="alert">{zoneError}</p>}
                  <div className="zone-editor-actions">
                    <button type="button" className="button button-primary" disabled={zoneBusy || !zoneDraftCenter || zonePlacingCenter} onClick={() => zoneDraftCenter && void commitZone(zoneDraftCenter, zoneDraftRadius)}>{zoneBusy ? 'Enregistrement…' : 'Enregistrer le terrain'}</button>
                    <button type="button" className="button button-ghost" disabled={zoneBusy} onClick={cancelZoneEditing}>Annuler</button>
                    {sharedZone && <button type="button" className="button button-ghost zone-remove-button" disabled={zoneBusy} onClick={() => void commitZone(null, null)}>Retirer</button>}
                  </div>
                </div>}
              </section>
              <GameModeIdeas />
              <ul className="members">{snapshot.members.map((member) => {
                const location = snapshot.locations.find((item) => item.user_id === member.user_id);
                const fresh = Boolean(location && isPositionFresh(location.updated_at, freshnessNow));
                const currentLocation = fresh && location ? location : null;
                const memberZoneState = getZoneState(currentLocation, sharedZone);
                const own = member.user_id === userId;
                const nickname = member.profiles?.nickname ?? 'Joueur';
                const zoneReadout = sharedZone ? (fresh ? zoneStateLabel(memberZoneState) : location ? 'Signal ancien' : 'Balise en attente') : '';
                return <li key={member.user_id}><button type="button" className={`member-row ${focusedPlayerId === member.user_id ? 'selected' : ''}`} onClick={() => selectPlayer(member.user_id)} aria-label={`${nickname}, ${fresh ? 'centrer la carte sur sa position' : 'aucune position récente'}${zoneReadout ? `, ${zoneReadout}` : ''}`} aria-current={focusedPlayerId === member.user_id ? 'true' : undefined}><span className={`member-avatar ${own ? 'self' : ''} ${fresh ? 'online' : ''}`}>{nickname.slice(0, 1).toUpperCase()}</span><span className="member-copy"><strong>{nickname}{own && <span className="you-tag">toi</span>}</strong><small>{fresh ? `${formatAge(location?.updated_at)} · ±${location?.accuracy == null ? '—' : Math.round(location.accuracy)} m${zoneReadout ? ` · ${zoneReadout}` : ''}` : location ? `Dernier signal · ${formatAge(location.updated_at)}` : 'En attente de position'}</small></span><span className={`presence-dot ${fresh ? 'online' : ''} ${own ? 'self' : ''}`} aria-label={fresh ? 'Position récente' : 'Sans position récente'} /></button></li>;
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

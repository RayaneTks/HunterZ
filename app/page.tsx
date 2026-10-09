'use client';

import dynamic from 'next/dynamic';
import Brand from '../components/Brand';
import HomeScreen from '../components/HomeScreen';
import LobbyScreen from '../components/LobbyScreen';
import MatchScreen from '../components/MatchScreen';
import MatchPreparation from '../components/MatchPreparation';
import { useMatch } from '../hooks/use-match';
import { Capacitor } from '@capacitor/core';
import { ArrowRight, Check, ChevronDown, CircleAlert, Compass, Copy, Crosshair, LogOut, MapPin, Radio, Share2, ShieldCheck, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGeolocation } from '../hooks/use-geolocation';
import InstallPrompt from '../components/InstallPrompt';
import { closeRoom, createRoom, ensureAnonymousSession, getProfile, getRoom, joinRoom, leaveRoom, loadLobby, saveHuntZone, saveProfile } from '../lib/hunt';
import { hapticTap } from '../lib/haptics';
import { supabase } from '../lib/supabase';
import type { HuntZone, LobbySnapshot, Room } from '../lib/types';

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
type SquadSheetMode = 'compact' | 'intermediate' | 'expanded';

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
  const game = useMatch(room?.id ?? null);
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
  const [sheetMode, setSheetMode] = useState<SquadSheetMode>('compact');
  const squadExpanded = sheetMode !== 'compact';
  const [gpsConsentOpen, setGpsConsentOpen] = useState(false);
  const [desktopLobby, setDesktopLobby] = useState(false);
  const [focusedPlayerId, setFocusedPlayerId] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState('');
  const [zoneEditing, setZoneEditing] = useState(false);
  const [zonePlacingCenter, setZonePlacingCenter] = useState(false);
  const [zoneDraftCenter, setZoneDraftCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [zoneDraftRadius, setZoneDraftRadius] = useState(500);
  const [zoneBusy, setZoneBusy] = useState(false);
  const [zoneError, setZoneError] = useState('');
  const gpsConsentTrigger = useRef<HTMLButtonElement>(null);
  const gpsConsentDialog = useRef<HTMLElement>(null);
  const gpsConsentConfirm = useRef<HTMLButtonElement>(null);
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

  useEffect(() => {
    if (!gpsConsentOpen) return;
    const activeDialog = gpsConsentDialog.current;
    gpsConsentConfirm.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setGpsConsentOpen(false);
        gpsConsentTrigger.current?.focus();
        return;
      }
      if (event.key !== 'Tab' || !activeDialog) return;
      const focusable = activeDialog.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      const first = focusable.item(0);
      const last = focusable.item(focusable.length - 1);
      if (!activeDialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [gpsConsentOpen]);
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
    setSheetMode('compact');
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

  if (room && game.match) return <MatchScreen match={game.match} me={userId} host={room.owner_id===userId} code={room.code} gps={gps} fresh={game.fresh} error={game.error} busy={game.busy} onAction={game.act} onExit={() => void handleExit()} />;

  return (
    <main className={`app-shell ${room ? 'app-shell-lobby' : ''}`}>
      <header className="app-header">
        <Brand />
        {nickname && <CompactUserActions nickname={nickname} editing={editingProfile} nicknameInput={nicknameInput} busy={busy} errorMessage={errorScope === 'profile' ? error : undefined} onEdit={() => { clearError(); setEditingProfile(true); }} onSave={() => void handleLogin()} onCancel={() => { setNicknameInput(nickname); setEditingProfile(false); clearError(); }} onLogout={() => void handleLogout()} onChange={setNicknameInput} />}
      </header>

      {error && errorScope === 'global' && <div className="alert" role="alert"><CircleAlert size={17} /><span>{error}</span><button className="icon-button" onClick={clearError} aria-label="Fermer"><X size={18} /></button></div>}

      {!room ? <HomeScreen nickname={nickname} nicknameInput={nicknameInput} invite={pendingInvite} joinCode={joinCode} busy={busy} error={error} errorScope={errorScope} onNickname={setNicknameInput} onCode={setJoinCode} onLogin={() => void handleLogin()} onCreate={() => void handleCreate()} onJoin={() => void handleJoin()} /> : (
        <LobbyScreen map={<>
            <MapView
              key={room.id}
              locations={recentLocations}
              me={userId}
              recenterSignal={recenterSignal}
              focusedPlayerId={focusedPlayerId}
              onSelectPlayer={selectPlayer}
              zone={displayedZone}
              onMapTap={() => {
                if (!zonePlacingCenter && !desktopLobby && sheetMode !== 'compact' && !zoneEditing) {
                  setSheetMode('compact');
                }
              }}
              onMapCenterChange={zoneEditing && zonePlacingCenter ? setZoneDraftCenter : undefined}
              placementMode={zoneEditing && zonePlacingCenter}
            />
        </>} tools={<>
            <div className="field-map-header"><div className="room-identity"><p className="eyebrow">CHASSE PRIVÉE</p><h1>{room.code}</h1></div><div className="room-invite-actions"><InviteButton code={room.code} /><CopyButton value={room.code} label="Copier le code" /></div></div>
            <div className="map-live"><span className="rec-dot" /><span>{syncing ? 'Actualisation' : activeLocationCount ? 'Balises récentes' : 'En attente'} · {activeLocationCount}</span></div>
            <p className="sr-only" role="status" aria-live="polite">{actionNotice}</p>
            {zonePlacingCenter && <div className="map-pick-banner" role="status"><MapPin size={16} /> Fais glisser la carte sous le repère, puis confirme le point choisi.</div>}
            {sharedZone && <div className={`zone-map-state zone-state-${ownZoneState}`} role="status" aria-live="polite"><MapPin size={17} /><span><strong>{zoneStateLabel(ownZoneState)}</strong><small>{zoneStateHint(ownZoneState)}</small></span></div>}
            {activeLocationCount === 0 && !sharedZone && <p className="map-empty-readout">Active une balise pour apparaître sur la carte.</p>}
            <button className="map-recenter" disabled={!ownFreshLocation || (zoneEditing && zonePlacingCenter)} onClick={() => { setRecenterSignal((value) => value + 1); setFocusedPlayerId(userId); }} aria-label={zoneEditing && zonePlacingCenter ? 'Recentrage indisponible pendant le placement du terrain' : ownFreshLocation ? 'Centrer sur ma position' : 'Ta position récente n’est pas disponible. Active le partage pour te localiser.'}><Crosshair size={21} /></button>        </>} sheet={<>
          <aside className="squad-sheet" data-sheet-state={sheetMode} aria-label="Escouade">
            <button className="sheet-toggle" disabled={desktopLobby} onClick={() => setSheetMode(current => current === 'compact' ? 'intermediate' : 'compact')} aria-expanded={squadExpanded || desktopLobby} aria-controls="squad-content"><span className="sheet-handle" aria-hidden="true" /><span className="sheet-heading"><span>Escouade <small>{snapshot.members.length}</small></span><ChevronDown size={19} /></span><span className="sr-only">{squadExpanded ? 'Réduire le panneau' : 'Développer le panneau'}</span></button>
            <div className="beacon-row"><SignalStatus state={gps.state} accuracy={gps.accuracy} lastUpdate={gps.lastUpdate} errorMessage={gps.errorMessage} /><button ref={gpsConsentTrigger} className={`beacon-switch ${sharing ? 'active' : ''}`} role="switch" aria-checked={sharing} aria-label="Partager ma position avec l’escouade" onClick={() => { if (sharing) void gps.stop(); else setGpsConsentOpen(true); }}><span /></button></div>
            <p className="beacon-privacy-note">{sharing ? 'Ta position est partagée avec les membres de ce salon. Tu peux arrêter à tout moment.' : 'Aucune position n’est partagée avant ton accord. Seuls les membres de ce salon la verront.'}</p>
            <div className="squad-content" id="squad-content">
              {sheetMode === 'intermediate' && <button type="button" className="button button-ghost button-wide sheet-expand-action" onClick={() => setSheetMode('expanded')}>Afficher tous les détails</button>}
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
                  <button type="button" className="button button-soft button-wide zone-edit-button" disabled={zonePlacingCenter && !zoneDraftCenter} onClick={() => { if (zonePlacingCenter) { setZonePlacingCenter(false); setActionNotice('Centre du terrain confirmé. Ajuste le rayon puis enregistre.'); } else { setZonePlacingCenter(true); setActionNotice('Fais glisser la carte sous le repère, puis confirme.'); } }}>{zonePlacingCenter ? 'Confirmer ce point' : 'Placer le centre sur la carte'}<MapPin size={16} /></button>
                  {zonePlacingCenter && <button type="button" className="button button-ghost button-wide zone-location-button" onClick={() => { setZonePlacingCenter(false); setActionNotice('Placement du centre annulé.'); }}>Annuler le placement</button>}
                  {ownFreshLocation && <button type="button" className="button button-ghost button-wide zone-location-button" onClick={() => { setZoneDraftCenter({ latitude: ownFreshLocation.latitude, longitude: ownFreshLocation.longitude }); setZonePlacingCenter(false); setActionNotice('Centre placé sur ta balise. Ajuste le rayon puis enregistre.'); }}>Utiliser ma position actuelle</button>}
                  <p className="zone-center-readout">{zonePlacingCenter ? 'Le repère au centre de la carte indique le point sélectionné.' : zoneDraftCenter ? 'Centre prêt · tu peux encore le replacer.' : 'Aucun centre choisi.'}</p>
                  {zoneError && <p className="zone-error" role="alert">{zoneError}</p>}
                  <div className="zone-editor-actions">
                    <button type="button" className="button button-primary" disabled={zoneBusy || !zoneDraftCenter || zonePlacingCenter} onClick={() => zoneDraftCenter && void commitZone(zoneDraftCenter, zoneDraftRadius)}>{zoneBusy ? 'Enregistrement…' : 'Enregistrer le terrain'}</button>
                    <button type="button" className="button button-ghost" disabled={zoneBusy} onClick={cancelZoneEditing}>Annuler</button>
                    {sharedZone && <button type="button" className="button button-ghost zone-remove-button" disabled={zoneBusy} onClick={() => void commitZone(null, null)}>Retirer</button>}
                  </div>
                </div>}
              </section>
              <MatchPreparation members={snapshot.members} host={room.owner_id===userId} terrainReady={Boolean(sharedZone)} busy={game.busy} available={game.available} onPrepare={target => void game.act('create',{target})} />
              {game.error && <p className="action-error" role="alert">{game.error}</p>}

              <div className="sheet-details">
                <div className="precision-option"><ShieldCheck size={18} /><span><strong>Localisation précise</strong><small>HUNT demande la meilleure précision disponible. Active « Position exacte » dans les réglages de ton appareil.</small></span></div>
                <p className="precision-note">La précision affichée dépend du GPS et de ton environnement.</p>
                <button className="button button-exit button-wide" disabled={busy} onClick={() => void handleExit()}><LogOut size={16} />{room.owner_id === userId ? 'Fermer la chasse' : 'Quitter la chasse'}</button>
              </div>
            </div>
          </aside>        </>} dialogs={<>

          {gpsConsentOpen && <div className="gps-consent-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) { setGpsConsentOpen(false); gpsConsentTrigger.current?.focus(); } }}>
            <section ref={gpsConsentDialog} className="gps-consent-dialog" role="dialog" aria-modal="true" aria-labelledby="gps-consent-title">
              <div className="gps-consent-heading"><span className="lobby-kicker">BALISE DE L’ESCOUADE</span><button className="icon-button" onClick={() => { setGpsConsentOpen(false); gpsConsentTrigger.current?.focus(); }} aria-label="Fermer"><X size={17} /></button></div>
              <h2 id="gps-consent-title">Partager ta position ?</h2>
              <p>Ta position sera visible par les membres de ce salon pendant le partage. Tu peux l’arrêter à tout moment depuis l’escouade.</p>
              {Capacitor.isNativePlatform()
                ? <p>HUNT utilise le service de localisation de ton téléphone. Selon l’appareil et ses réglages, le partage peut s’interrompre si l’application passe en arrière-plan. Pour garder ta balise à jour, laisse HUNT ouverte.</p>
                : <p>Dans le navigateur, le partage fonctionne tant que HUNT reste ouverte. HUNT ne démarre pas le GPS avant ton accord.</p>}
              <p className="gps-consent-safety">La carte aide l’escouade à se repérer; elle ne garantit pas la sécurité du trajet.</p>
              <div className="gps-consent-actions"><button ref={gpsConsentConfirm} className="button button-primary" onClick={() => { setGpsConsentOpen(false); void gps.start(); }}>Continuer vers l’autorisation</button><button className="button button-ghost" onClick={() => { setGpsConsentOpen(false); gpsConsentTrigger.current?.focus(); }}>Pas maintenant</button></div>
            </section>
          </div>}
        </>} />
      )}
      {!room && <InstallPrompt />}
    </main>
  );
}

'use client';

import dynamic from 'next/dynamic';
import { ArrowRight, Check, Copy, Crosshair, LogOut, MapPin, Plus, Radar, Search, ShieldCheck, Signal, Users, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGeolocation } from '../hooks/use-geolocation';
import InstallPrompt from '../components/InstallPrompt';
import { closeRoom, createRoom, ensureAnonymousSession, getProfile, getRoom, joinRoom, leaveRoom, loadLobby, saveProfile, searchProfiles } from '../lib/hunt';
import { supabase } from '../lib/supabase';
import type { LobbySnapshot, Profile, Room } from '../lib/types';

const MapView = dynamic(() => import('../components/MapView'), { ssr: false });
const ROOM_STORAGE_KEY = 'hunt:active-room';

function messageFromError(error: unknown) {
  if (error instanceof Error) return error.message;
  return 'Une erreur inattendue est survenue.';
}

function GpsBadge({ state, accuracy }: { state: ReturnType<typeof useGeolocation>['state']; accuracy: number | null }) {
  const labels = {
    off: 'GPS en pause',
    requesting: 'Autorisation…',
    active: accuracy ? `GPS actif · ±${Math.round(accuracy)} m` : 'GPS actif',
    denied: 'GPS refusé',
    unavailable: 'GPS indisponible',
  } as const;
  return <span className={`gps-badge ${state}`}><Signal size={14} />{labels[state]}</span>;
}

function CopyButton({ value, label = 'Copier' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard?.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return <button className="button button-ghost button-small" onClick={() => void copy()}><span>{copied ? <Check size={15} /> : <Copy size={15} />}</span>{copied ? 'Copié' : label}</button>;
}

function Brand() {
  return <div className="brand-lockup"><div className="brand-icon"><Radar size={19} strokeWidth={2.5} /></div><div><p className="brand-name">HUNT<span>.</span></p><p className="brand-caption">FIELD LOBBY · V0.1</p></div></div>;
}

function UserActions({ nickname, editing, nicknameInput, busy, onEdit, onSave, onCancel, onLogout, onChange }: { nickname: string; editing: boolean; nicknameInput: string; busy: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void; onLogout: () => void; onChange: (value: string) => void }) {
  if (editing) {
    return <div className="profile-editor"><input aria-label="Modifier le pseudo" value={nicknameInput} maxLength={24} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} /><button className="button button-small" onClick={onSave} disabled={busy}>Enregistrer</button><button className="button button-ghost button-small icon-button" onClick={onCancel} aria-label="Annuler"><X size={16} /></button></div>;
  }
  return <div className="user-actions"><span className="user-chip"><span className="user-avatar">{nickname.slice(0, 1).toUpperCase()}</span>{nickname}</span><button className="button button-ghost button-small" onClick={onEdit}>Modifier</button><button className="button button-ghost button-small icon-button" onClick={onLogout} disabled={busy} aria-label="Se déconnecter"><LogOut size={16} /></button></div>;
}

function LoadingScreen() {
  return <main className="app-shell centered"><div className="loader-mark"><Radar size={22} /></div><p className="loading-copy">Connexion sécurisée en cours…</p></main>;
}

export default function Home() {
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [nicknameInput, setNicknameInput] = useState('');
  const [room, setRoom] = useState<Room | null>(null);
  const [snapshot, setSnapshot] = useState<LobbySnapshot>({ members: [], locations: [] });
  const [joinCode, setJoinCode] = useState('');
  const [search, setSearch] = useState('');
  const [results, setResults] = useState<Profile[]>([]);
  const [editingProfile, setEditingProfile] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [booting, setBooting] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [recenterSignal, setRecenterSignal] = useState(0);

  const gps = useGeolocation(room?.id, userId);

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

        const savedRoom = window.localStorage.getItem(ROOM_STORAGE_KEY);
        if (savedRoom) {
          try {
            const parsed = JSON.parse(savedRoom) as { id?: string };
            if (parsed.id) {
              const restored = await getRoom(parsed.id);
              if (restored && !cancelled) setRoom(restored);
              else window.localStorage.removeItem(ROOM_STORAGE_KEY);
            }
          } catch {
            window.localStorage.removeItem(ROOM_STORAGE_KEY);
          }
        }
      } catch (bootError) {
        if (!cancelled) setError(messageFromError(bootError));
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
      setSnapshot(await loadLobby(room));
    } catch (loadError) {
      setError(messageFromError(loadError));
    } finally {
      setSyncing(false);
    }
  }, [room]);

  useEffect(() => {
    if (!room || !supabase) return;
    const client = supabase;
    void refreshLobby();
    const channel = client.channel(`lobby-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions', filter: `room_id=eq.${room.id}` }, refreshLobby)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'room_members', filter: `room_id=eq.${room.id}` }, refreshLobby)
      .subscribe((status) => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('La synchronisation temps réel est temporairement indisponible.');
      });
    const fallback = window.setInterval(() => void refreshLobby(), 7000);
    return () => {
      window.clearInterval(fallback);
      void client.removeChannel(channel);
    };
  }, [room, refreshLobby]);

  const recentLocations = useMemo(() => snapshot.locations.filter((location) => Date.now() - new Date(location.updated_at).getTime() < 45_000), [snapshot.locations]);

  async function handleLogin() {
    const value = nicknameInput.trim();
    if (value.length < 2 || value.length > 24) {
      setError('Le pseudo doit contenir entre 2 et 24 caractères.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const id = userId || (await ensureAnonymousSession()).id;
      const profile = await saveProfile(id, value);
      setUserId(id);
      setNickname(profile.nickname);
      setEditingProfile(false);
    } catch (loginError) {
      setError(messageFromError(loginError));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreate() {
    setBusy(true);
    setError('');
    try {
      const created = await createRoom();
      const nextRoom = { ...created, owner_id: userId };
      setRoom(nextRoom);
      window.localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(nextRoom));
    } catch (createError) {
      setError(messageFromError(createError));
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    setBusy(true);
    setError('');
    try {
      const nextRoom = await joinRoom(joinCode);
      setRoom(nextRoom);
      window.localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(nextRoom));
      setJoinCode('');
    } catch (joinError) {
      setError(messageFromError(joinError));
    } finally {
      setBusy(false);
    }
  }

  async function handleSearch() {
    const query = search.trim();
    if (query.length < 2) {
      setResults([]);
      return;
    }
    try {
      setResults(await searchProfiles(query));
    } catch (searchError) {
      setError(messageFromError(searchError));
    }
  }

  async function handleExit() {
    if (!room) return;
    setBusy(true);
    setError('');
    try {
      await gps.stop();
      if (room.owner_id === userId) await closeRoom(room.id);
      else await leaveRoom(room.id);
      window.localStorage.removeItem(ROOM_STORAGE_KEY);
      setRoom(null);
      setSnapshot({ members: [], locations: [] });
    } catch (exitError) {
      setError(messageFromError(exitError));
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
      window.localStorage.removeItem(ROOM_STORAGE_KEY);
      setRoom(null);
      setSnapshot({ members: [], locations: [] });
      setUserId('');
      setNickname('');
      setNicknameInput('');
    } catch (logoutError) {
      setError(messageFromError(logoutError));
    } finally {
      setBusy(false);
    }
  }

  if (!supabase) {
    return <main className="app-shell centered"><section className="empty-state"><div className="empty-icon"><Radar size={22} /></div><p className="eyebrow">CONFIGURATION REQUISE</p><h1 className="display-title">HUNT<span>.</span></h1><p className="muted">Ajoute les variables Supabase dans `.env.local` pour démarrer le prototype.</p></section></main>;
  }

  if (booting) return <LoadingScreen />;

  return (
    <main className="app-shell">
      <header className="app-header">
        <Brand />
        {nickname && <UserActions nickname={nickname} editing={editingProfile} nicknameInput={nicknameInput} busy={busy} onEdit={() => setEditingProfile(true)} onSave={() => void handleLogin()} onCancel={() => { setNicknameInput(nickname); setEditingProfile(false); }} onLogout={() => void handleLogout()} onChange={setNicknameInput} />}
      </header>

      {error && <div className="alert" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Fermer"><X size={18} /></button></div>}
      <InstallPrompt />

      {!nickname ? (
        <section className="welcome-layout">
          <div className="welcome-copy">
            <div className="eyebrow-row"><span className="live-dot" /> LOBBY GPS EN TEMPS RÉEL</div>
            <h1 className="display-title">Restez<br /><em>ensemble.</em></h1>
            <p className="lead">Une carte privée pour retrouver ton équipe sur le terrain, au moment où ça compte.</p>
            <div className="trust-row"><span><ShieldCheck size={16} /> Session anonyme</span><span><MapPin size={16} /> GPS privé au lobby</span></div>
          </div>
          <section className="panel auth-card">
            <div className="auth-card-top"><span className="step-index">01</span><span className="muted">Ton identité de terrain</span></div>
            <h2>Choisis ton indicatif.</h2>
            <p className="muted">Un pseudo suffit. Tu pourras le modifier à tout moment.</p>
            <label className="field-label" htmlFor="nickname">Pseudo</label>
            <input id="nickname" placeholder="Ex. Nova" value={nicknameInput} maxLength={24} onChange={(event) => setNicknameInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin(); }} autoComplete="nickname" autoFocus />
            <button className="button button-primary button-wide" disabled={busy} onClick={() => void handleLogin()}>{busy ? 'Connexion…' : 'Entrer dans HUNT'}<ArrowRight size={17} /></button>
            <small className="form-note">Le GPS sera demandé uniquement après ton entrée dans un lobby.</small>
          </section>
        </section>
      ) : !room ? (
        <section className="home-view">
          <div className="page-intro"><div><p className="eyebrow">BONJOUR, {nickname.toUpperCase()}</p><h1>On part où ?</h1><p className="lead-small">Crée une escouade ou rejoins-en une avec son code.</p></div><div className="intro-status"><span className="live-dot" /> Prêt</div></div>
          <div className="action-grid">
            <section className="panel action-card action-card-primary"><div className="action-icon"><Plus size={22} /></div><div><p className="eyebrow">NOUVELLE SESSION</p><h2>Créer un lobby</h2><p className="muted">Lance une zone privée et invite ton équipe.</p></div><button className="button button-primary button-wide" disabled={busy} onClick={() => void handleCreate()}>Créer la partie <ArrowRight size={17} /></button></section>
            <section className="panel action-card"><div className="action-icon action-icon-muted"><Users size={22} /></div><div><p className="eyebrow">REJOINDRE</p><h2>Entrer un code</h2><p className="muted">Suis ton équipe avec son code à 6 caractères.</p></div><div className="join-row"><input id="join-code" aria-label="Code d’invitation" placeholder="A B C 1 2 3" value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter' && joinCode.length === 6) void handleJoin(); }} /><button className="button button-soft" disabled={busy || joinCode.length !== 6} onClick={() => void handleJoin()} aria-label="Rejoindre le lobby"><ArrowRight size={18} /></button></div></section>
          </div>
          <section className="panel search-panel"><div className="search-heading"><div><p className="eyebrow">RÉSEAU</p><h2>Retrouver un joueur</h2></div><Search size={19} className="muted-icon" /></div><div className="search-row"><input aria-label="Recherche joueur" placeholder="Pseudo ou identifiant" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleSearch(); }} /><button className="button button-soft" onClick={() => void handleSearch()}>Rechercher</button></div>{results.length > 0 && <div className="results">{results.map((profile) => <div className="result-row" key={profile.id}><div><strong>{profile.nickname}</strong><small>{profile.id}</small></div><CopyButton value={profile.id} label="Copier l’ID" /></div>)}</div>}<div className="identity-row"><span className="muted">Ton identifiant HUNT</span><code>{userId}</code><CopyButton value={userId} label="Copier" /></div></section>
        </section>
      ) : (
        <section className="lobby-layout">
          <section className="panel map-panel"><div className="map-header"><div><p className="eyebrow">LOBBY EN DIRECT</p><h1>{room.code}<span className="map-title-label"> · {snapshot.members.length} joueurs</span></h1></div><button className="button button-soft button-small" onClick={() => setRecenterSignal((value) => value + 1)}><Crosshair size={15} /> Recentrer</button></div><div className="map-wrap"><MapView locations={recentLocations} me={userId} recenterSignal={recenterSignal} /><div className="map-overlay"><span className="map-live"><span className="live-dot" /> LIVE</span><span className="map-location-count"><MapPin size={13} /> {recentLocations.length} position{recentLocations.length > 1 ? 's' : ''}</span></div></div><div className="map-footer"><span><i className="legend-dot own" /> Toi</span><span><i className="legend-dot other" /> Équipe</span><span className="map-expiry">Les positions expirent après 45 s</span></div></section>
          <aside className="panel lobby-sidebar"><div className="sidebar-heading"><div><p className="eyebrow">TON ESCOUADE</p><h2>Zone de chasse</h2></div><div className="sync-state"><span className="live-dot" />{syncing ? 'Sync…' : 'Synchronisé'}</div></div><div className="invite-box"><div><small>CODE D’INVITATION</small><strong>{room.code}</strong></div><CopyButton value={room.code} label="Partager le code" /></div><div className="gps-card"><div className="gps-card-head"><div><p className="eyebrow">MA LOCALISATION</p><GpsBadge state={gps.state} accuracy={gps.accuracy} /></div><div className={`gps-orb ${gps.state}`}><MapPin size={19} /></div></div><button className={`button button-wide ${gps.state === 'active' ? 'button-danger' : 'button-primary'}`} onClick={() => void (gps.state === 'active' || gps.state === 'requesting' ? gps.stop() : gps.start())}>{gps.state === 'active' ? 'Arrêter le partage GPS' : 'Activer ma localisation'}</button><small>Visible uniquement par les membres de ce lobby.</small></div><div className="members-section"><div className="list-heading"><h3>Participants</h3><span>{recentLocations.length}/{snapshot.members.length} GPS actifs</span></div><ul className="members">{snapshot.members.map((member) => { const location = snapshot.locations.find((item) => item.user_id === member.user_id); const fresh = Boolean(location && Date.now() - new Date(location.updated_at).getTime() < 45_000); return <li key={member.user_id}><span className={`member-avatar ${fresh ? 'online' : ''}`}>{(member.profiles?.nickname ?? 'J').slice(0, 1).toUpperCase()}</span><div><strong>{member.profiles?.nickname ?? 'Joueur'}{member.user_id === userId && <span className="you-tag">toi</span>}</strong><small>{fresh ? `Position reçue · ±${Math.round(location?.accuracy ?? 0)} m` : 'Position non partagée'}</small></div><span className={`presence-dot ${fresh ? 'online' : ''}`} /></li>; })}</ul></div><div className="sidebar-footer"><button className="button button-ghost button-wide" disabled={busy} onClick={() => void handleExit()}>{room.owner_id === userId ? 'Fermer le lobby' : 'Quitter le lobby'}</button><small>Le lobby est privé et protégé par RLS.</small></div></aside>
        </section>
      )}
    </main>
  );
}

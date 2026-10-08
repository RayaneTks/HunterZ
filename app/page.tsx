'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useGeolocation } from '../hooks/use-geolocation';
import {
  closeRoom,
  createRoom,
  ensureAnonymousSession,
  getProfile,
  getRoom,
  joinRoom,
  leaveRoom,
  loadLobby,
  saveProfile,
  searchProfiles,
} from '../lib/hunt';
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
    off: 'GPS désactivé',
    requesting: 'Autorisation en cours…',
    active: accuracy ? `GPS actif · ±${Math.round(accuracy)} m` : 'GPS actif',
    denied: 'Autorisation refusée',
    unavailable: 'GPS indisponible',
  } as const;
  return <span className={`gps-status ${state}`}>{labels[state]}</span>;
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
    return () => {
      cancelled = true;
    };
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
    const channel = client
      .channel(`lobby-${room.id}`)
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

  const recentLocations = useMemo(
    () => snapshot.locations.filter((location) => Date.now() - new Date(location.updated_at).getTime() < 45_000),
    [snapshot.locations],
  );

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
    return <main className="shell centered"><section className="panel hero"><p className="eyebrow">CONFIGURATION REQUISE</p><h1 className="brand">HUNT<span>.</span></h1><p className="muted">Ajoute les variables Supabase dans `.env.local` pour démarrer le prototype.</p></section></main>;
  }

  if (booting) return <main className="shell centered"><div className="loader" aria-label="Chargement" /><p className="muted">Connexion sécurisée en cours…</p></main>;

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">REAL-TIME FIELD LOBBY</p><h1 className="brand">HUNT<span>.</span></h1></div>
        {nickname && <div className="top-actions">{editingProfile ? <><input style={{ width: 150 }} aria-label="Modifier le pseudo" value={nicknameInput} maxLength={24} onChange={(event) => setNicknameInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin(); }} /><button className="compact" onClick={() => void handleLogin()} disabled={busy}>Enregistrer</button><button className="secondary compact" onClick={() => { setNicknameInput(nickname); setEditingProfile(false); }}>Annuler</button></> : <><span className="pill">● {nickname}</span><button className="secondary compact" onClick={() => setEditingProfile(true)}>Modifier</button><button className="secondary compact" onClick={() => void handleLogout()} disabled={busy}>Déconnexion</button></>}</div>}
      </header>

      {error && <div className="alert" role="alert"><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Fermer">×</button></div>}

      {!nickname ? (
        <section className="panel hero login-card">
          <p className="eyebrow">MISSION CONTROL · V0.1</p>
          <h2>Retrouve ton équipe sur le terrain.</h2>
          <p className="muted">Choisis un pseudo. La session est anonyme et persistante sur cet appareil.</p>
          <label className="field-label" htmlFor="nickname">Pseudo</label>
          <input id="nickname" placeholder="Ex. Nova" value={nicknameInput} maxLength={24} onChange={(event) => setNicknameInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin(); }} autoComplete="nickname" />
          <button disabled={busy} onClick={() => void handleLogin()}>{busy ? 'Connexion…' : 'Entrer dans HUNT'}</button>
          <small>Le GPS ne sera demandé qu’après ton entrée dans un lobby.</small>
        </section>
      ) : !room ? (
        <div className="dashboard-grid">
          <section className="panel stack">
            <div className="section-heading"><div><p className="eyebrow">QUICK DEPLOY</p><h2>Former une équipe</h2></div><span className="status-dot" /></div>
            <p className="muted">Crée un lobby privé et partage son code à ton groupe.</p>
            <button disabled={busy} onClick={() => void handleCreate()}>+ Créer un lobby</button>
            <div className="separator"><span>ou rejoindre</span></div>
            <label className="field-label" htmlFor="join-code">Code d’invitation</label>
            <input id="join-code" placeholder="6 caractères" value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter' && joinCode.length === 6) void handleJoin(); }} />
            <button disabled={busy || joinCode.length !== 6} className="secondary" onClick={() => void handleJoin()}>Rejoindre le lobby</button>
          </section>
          <section className="panel stack">
            <div><p className="eyebrow">NETWORK</p><h2>Rechercher un joueur</h2></div>
            <p className="muted">Retrouve un pseudo ou colle un identifiant utilisateur.</p>
            <div className="input-action"><input aria-label="Recherche joueur" placeholder="Pseudo ou identifiant" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleSearch(); }} /><button className="secondary" onClick={() => void handleSearch()}>Chercher</button></div>
            <div className="results">{results.map((profile) => <div className="result-row" key={profile.id}><div><strong>{profile.nickname}</strong><small>{profile.id}</small></div><button className="secondary compact" onClick={() => void navigator.clipboard?.writeText(profile.id)}>Copier ID</button></div>)}</div>
            <div className="identity"><small>Ton identifiant HUNT</small><code>{userId}</code><button className="secondary" onClick={() => void navigator.clipboard?.writeText(userId)}>Copier mon identifiant</button></div>
            <p className="privacy-note">Les coordonnées GPS ne sont jamais exposées par la recherche. Elles restent limitées aux membres du même lobby.</p>
          </section>
        </div>
      ) : (
        <div className="lobby-layout">
          <aside className="panel lobby-sidebar stack">
            <div className="section-heading"><div><p className="eyebrow">ACTIVE LOBBY</p><h2>Zone de chasse</h2></div><span className="pill">{snapshot.members.length} joueurs</span></div>
            <div className="invite-box"><small>CODE D’INVITATION</small><strong>{room.code}</strong><button className="secondary" onClick={() => void navigator.clipboard?.writeText(room.code)}>Copier le code</button></div>
            <div className="gps-card"><div className="row-between"><span className="field-label">Ma localisation</span><GpsBadge state={gps.state} accuracy={gps.accuracy} /></div><button className={gps.state === 'active' ? 'danger' : ''} onClick={() => void (gps.state === 'active' || gps.state === 'requesting' ? gps.stop() : gps.start())}>{gps.state === 'active' ? 'Arrêter le partage GPS' : 'Activer ma localisation'}</button><small>Ta position est visible uniquement dans ce lobby. Le navigateur peut demander une autorisation précise.</small></div>
            <div><div className="row-between"><h3>Participants</h3><span className="muted">{recentLocations.length}/{snapshot.members.length} GPS</span></div><ul className="members">{snapshot.members.map((member) => { const location = snapshot.locations.find((item) => item.user_id === member.user_id); const fresh = location && Date.now() - new Date(location.updated_at).getTime() < 45_000; return <li key={member.user_id}><span className={`member-dot ${fresh ? 'online' : ''}`} /><div><strong>{member.profiles?.nickname ?? 'Joueur'}</strong>{member.user_id === userId && <small>toi · hôte</small>}<small>{fresh ? `Position reçue · ±${Math.round(location?.accuracy ?? 0)} m` : 'Position non partagée'}</small></div></li>; })}</ul></div>
            <div className="sidebar-footer"><button className="secondary" disabled={busy} onClick={() => void handleExit()}>{room.owner_id === userId ? 'Fermer le lobby' : 'Quitter le lobby'}</button><small>{syncing ? 'Synchronisation…' : 'Synchronisé en temps réel'}</small></div>
          </aside>
          <section className="panel map-panel"><div className="section-heading"><div><p className="eyebrow">LIVE MAP</p><h2>Carte en direct</h2></div><button className="secondary compact" onClick={() => setRecenterSignal((value) => value + 1)}>Recentrer</button></div><MapView locations={recentLocations} me={userId} recenterSignal={recenterSignal} /><div className="map-footer"><span><i className="legend-dot own" /> Toi</span><span><i className="legend-dot other" /> Équipe</span><span>Les positions expirent après 45 s</span></div></section>
        </div>
      )}
    </main>
  );
}

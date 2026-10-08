'use client';

import dynamic from 'next/dynamic';
import { ArrowRight, Check, CircleAlert, Copy, Crosshair, LogOut, MapPin, Plus, Radio, Search, ShieldCheck, Signal, Target, Users, Wifi, X } from 'lucide-react';
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

function formatAge(timestamp: number | string | null | undefined) {
  if (!timestamp) return 'Aucun signal reçu';
  const value = typeof timestamp === 'number' ? timestamp : new Date(timestamp).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
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
    ? `${formatAge(lastUpdate)} · ±${accuracy ? Math.round(accuracy) : '—'} m`
    : errorMessage ?? (state === 'requesting' ? 'Autorise la localisation dans ton navigateur.' : 'Aucun partage de position en cours.');

  return <div className={`signal-status ${state}`}><span className="signal-status-mark" /><span><strong>{labels[state]}</strong><small>{detail}</small></span></div>;
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
  return <div className="brand-lockup"><div className="brand-signal" aria-hidden="true"><span /><span /><span /></div><div><p className="brand-name">HUNT<span>.</span></p><p className="brand-caption">SIGNAL / TRACE</p></div></div>;
}

function UserActions({ nickname, editing, nicknameInput, busy, onEdit, onSave, onCancel, onLogout, onChange }: { nickname: string; editing: boolean; nicknameInput: string; busy: boolean; onEdit: () => void; onSave: () => void; onCancel: () => void; onLogout: () => void; onChange: (value: string) => void }) {
  if (editing) {
    return <div className="profile-editor"><input aria-label="Modifier l’indicatif" value={nicknameInput} maxLength={24} onChange={(event) => onChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') onSave(); }} /><button className="button button-small button-primary" onClick={onSave} disabled={busy}>Enregistrer</button><button className="button button-ghost button-small icon-button" onClick={onCancel} aria-label="Annuler"><X size={16} /></button></div>;
  }
  return <div className="user-actions"><span className="user-chip"><span className="user-avatar">{nickname.slice(0, 1).toUpperCase()}</span>{nickname}</span><button className="button button-ghost button-small" onClick={onEdit}>Modifier</button><button className="button button-ghost button-small icon-button" onClick={onLogout} disabled={busy} aria-label="Se déconnecter"><LogOut size={16} /></button></div>;
}

function LoadingScreen() {
  return <main className="app-shell centered"><div className="loader-mark"><Radio size={22} /></div><p className="loading-copy">Connexion au terrain…</p></main>;
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
  const [preciseLocationAllowed, setPreciseLocationAllowed] = useState(true);

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
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setError('Le réseau de la chasse est momentanément indisponible.');
      });
    const fallback = window.setInterval(() => void refreshLobby(), 7000);
    return () => {
      window.clearInterval(fallback);
      void client.removeChannel(channel);
    };
  }, [room, refreshLobby]);

  useEffect(() => {
    if (!room || !preciseLocationAllowed) return;
    void gps.start();
    return () => { void gps.stop(); };
  }, [room?.id, preciseLocationAllowed, gps.start, gps.stop]);

  const recentLocations = useMemo(() => snapshot.locations.filter((location) => Date.now() - new Date(location.updated_at).getTime() < 45_000), [snapshot.locations]);
  const activeLocationCount = recentLocations.length;

  async function handleLogin() {
    const value = nicknameInput.trim();
    if (value.length < 2 || value.length > 24) {
      setError('L’indicatif doit contenir entre 2 et 24 caractères.');
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
    return <main className="app-shell centered"><section className="empty-state"><div className="empty-icon"><Radio size={22} /></div><p className="kicker">CONFIGURATION REQUISE</p><h1 className="display-title">HUNT<span>.</span></h1><p className="muted">Ajoute les variables Supabase pour ouvrir le terrain.</p></section></main>;
  }

  if (booting) return <LoadingScreen />;

  return (
    <main className="app-shell">
      <header className={`app-header ${room ? 'app-header-compact' : ''}`}>
        <Brand />
        {nickname && <UserActions nickname={nickname} editing={editingProfile} nicknameInput={nicknameInput} busy={busy} onEdit={() => setEditingProfile(true)} onSave={() => void handleLogin()} onCancel={() => { setNicknameInput(nickname); setEditingProfile(false); }} onLogout={() => void handleLogout()} onChange={setNicknameInput} />}
      </header>

      {error && <div className="alert" role="alert"><CircleAlert size={17} /><span>{error}</span><button className="icon-button" onClick={() => setError('')} aria-label="Fermer"><X size={18} /></button></div>}
      <InstallPrompt />

      {!nickname ? (
        <section className="welcome-layout">
          <div className="welcome-copy">
            <div className="kicker-row"><span className="signal-status-mark active" /> TERRAIN EN DIRECT</div>
            <h1 className="display-title">Lis le<br /><em>signal.</em></h1>
            <p className="lead">HUNT transforme votre ville en terrain de poursuite. Chaque joueur émet une balise, chaque seconde compte.</p>
            <div className="trace-note"><span className="trace-line" /><span>Marseille · réseau privé · position chiffrée</span></div>
          </div>
          <section className="panel entry-card">
            <div className="entry-card-heading"><span className="entry-index">01</span><span className="muted">Avant d’entrer sur le terrain</span></div>
            <Target className="entry-target" size={31} strokeWidth={1.5} />
            <p className="kicker">TON INDICATIF</p>
            <h2>Choisis ton nom de piste.</h2>
            <p className="muted">Un pseudo suffit. La localisation ne sera demandée qu’une fois dans une chasse.</p>
            <label className="field-label" htmlFor="nickname">Indicatif</label>
            <input id="nickname" placeholder="Ex. Nova" value={nicknameInput} maxLength={24} onChange={(event) => setNicknameInput(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleLogin(); }} autoComplete="nickname" autoFocus />
            <button className="button button-primary button-wide" disabled={busy} onClick={() => void handleLogin()}>{busy ? 'Connexion…' : 'Entrer sur le terrain'}<ArrowRight size={17} /></button>
            <small className="form-note"><ShieldCheck size={13} /> Session anonyme, position visible uniquement dans ta chasse.</small>
          </section>
        </section>
      ) : !room ? (
        <section className="command-view">
          <div className="page-intro"><div><p className="kicker">POSTE DE DÉPART · {nickname.toUpperCase()}</p><h1>Choisis ta chasse.</h1><p className="lead-small">Crée une balise privée ou rejoins ton escouade avec son code.</p></div><div className="network-state"><span className="signal-status-mark active" /> Réseau prêt</div></div>
          <div className="command-grid">
            <section className="panel command-card command-card-primary"><div className="command-card-top"><span className="command-symbol"><Plus size={21} /></span><span className="kicker">NOUVELLE CHASSE</span></div><div><h2>Ouvrir le terrain.</h2><p className="muted">Crée une salle privée et partage sa balise avec ton escouade.</p></div><button className="button button-primary button-wide" disabled={busy} onClick={() => void handleCreate()}>Créer une chasse <ArrowRight size={17} /></button></section>
            <section className="panel command-card"><div className="command-card-top"><span className="command-symbol command-symbol-cool"><Users size={21} /></span><span className="kicker">REJOINDRE</span></div><div><h2>Suivre le signal.</h2><p className="muted">Entre le code à six caractères reçu de ton escouade.</p></div><div className="join-row"><input id="join-code" aria-label="Code de chasse" placeholder="A B C 1 2 3" value={joinCode} maxLength={6} onChange={(event) => setJoinCode(event.target.value.replace(/[^a-z0-9]/gi, '').toUpperCase())} onKeyDown={(event) => { if (event.key === 'Enter' && joinCode.length === 6) void handleJoin(); }} /><button className="button button-soft" disabled={busy || joinCode.length !== 6} onClick={() => void handleJoin()} aria-label="Rejoindre la chasse"><ArrowRight size={18} /></button></div></section>
          </div>
          <section className="panel network-drawer"><div className="search-heading"><div><p className="kicker">RÉSEAU SECONDAIRE</p><h2>Retrouver un joueur.</h2></div><Search size={18} className="muted-icon" /></div><div className="search-row"><input aria-label="Recherche joueur" placeholder="Pseudo ou identifiant" value={search} onChange={(event) => setSearch(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void handleSearch(); }} /><button className="button button-soft" onClick={() => void handleSearch()}>Rechercher</button></div>{results.length > 0 && <div className="results">{results.map((profile) => <div className="result-row" key={profile.id}><div><strong>{profile.nickname}</strong><small>{profile.id}</small></div><CopyButton value={profile.id} label="Copier l’ID" /></div>)}</div>}<div className="identity-row"><span className="muted">Ton identifiant HUNT</span><code>{userId}</code><CopyButton value={userId} label="Copier" /></div></section>
        </section>
      ) : (
        <section className="lobby-view">
          <section className="field-map-shell">
            <div className="field-map-header"><div><p className="kicker">CHASSE EN DIRECT</p><h1><span className="code-mark">{room.code}</span><span className="map-title-label"> · {snapshot.members.length} dans l’escouade</span></h1></div><div className="network-state"><span className={`signal-status-mark ${syncing ? 'requesting' : 'active'}`} />{syncing ? 'Réception…' : 'Réseau à jour'}</div></div>
            <div className="map-wrap"><MapView key={room.id} locations={recentLocations} me={userId} recenterSignal={recenterSignal} /><div className="map-overlay"><span className="map-live"><span className="signal-status-mark active" /> LIVE</span><span className="map-readout"><MapPin size={13} /> {activeLocationCount} balise{activeLocationCount > 1 ? 's' : ''} active{activeLocationCount > 1 ? 's' : ''}</span></div><button className="map-recenter" onClick={() => setRecenterSignal((value) => value + 1)} aria-label="Me retrouver sur la carte"><Crosshair size={17} /><span>Me retrouver</span></button><div className="map-empty-readout">{activeLocationCount === 0 ? 'Aucun signal récent sur la carte' : 'Les signaux de plus de 45 s quittent la carte'}</div></div>
            <div className="map-footer"><span><i className="legend-dot own" /> Ta balise</span><span><i className="legend-dot squad" /> Escouade</span><span className="map-expiry">La liste conserve les derniers signaux connus</span></div>
          </section>

          <aside className="panel squad-sheet"><div className="sheet-handle" aria-hidden="true" /><div className="sheet-heading"><div><p className="kicker">ESCOUADE</p><h2>Les signaux du terrain</h2></div><div className="sheet-count">{activeLocationCount}/{snapshot.members.length}</div></div><div className="share-beacon"><div><small>CODE DE BALISE</small><strong>{room.code}</strong></div><CopyButton value={room.code} label="Partager" /></div>
            <div className={`beacon-panel ${gps.state}`}><div className="beacon-heading"><div><p className="kicker">MA BALISE</p><SignalStatus state={gps.state} accuracy={gps.accuracy} lastUpdate={gps.lastUpdate} errorMessage={gps.errorMessage} /></div><div className={`beacon-icon ${gps.state}`}><Radio size={19} /></div></div><button className={`button button-wide ${gps.state === 'active' ? 'button-danger' : 'button-primary'}`} onClick={() => void (gps.state === 'active' || gps.state === 'requesting' ? gps.stop() : gps.start())}>{gps.state === 'active' ? 'Couper ma balise' : 'Émettre ma balise'}<Signal size={16} /></button><label className="precision-option"><input type="checkbox" checked={preciseLocationAllowed} onChange={(event) => setPreciseLocationAllowed(event.target.checked)} /><span><strong>Autoriser la meilleure précision disponible</strong><small>HUNT la demande ; le navigateur et le système décident du niveau réel.</small></span></label></div>
            <div className="squad-section"><div className="list-heading"><div><p className="kicker">PRÉSENCE</p><h3>Escouade</h3></div><span>{activeLocationCount} signal{activeLocationCount > 1 ? 's' : ''} récent{activeLocationCount > 1 ? 's' : ''}</span></div><ul className="members">{snapshot.members.map((member) => { const location = snapshot.locations.find((item) => item.user_id === member.user_id); const fresh = Boolean(location && Date.now() - new Date(location.updated_at).getTime() < 45_000); return <li key={member.user_id}><span className={`member-avatar ${fresh ? 'online' : ''}`}>{(member.profiles?.nickname ?? 'Joueur').slice(0, 1).toUpperCase()}</span><div><strong>{member.profiles?.nickname ?? 'Joueur'}{member.user_id === userId && <span className="you-tag">toi</span>}</strong><small>{fresh ? `Signal reçu · ${formatAge(location?.updated_at)} · ±${Math.round(location?.accuracy ?? 0)} m` : location ? `Dernier signal · ${formatAge(location.updated_at)}` : 'Balise silencieuse'}</small></div><span className={`presence-dot ${fresh ? 'online' : ''}`} /></li>; })}</ul></div>
            <div className="sidebar-footer"><button className="button button-ghost button-wide" disabled={busy} onClick={() => void handleExit()}>{room.owner_id === userId ? 'Fermer la chasse' : 'Quitter la chasse'}</button><small><Wifi size={12} /> Position privée au lobby · pas de fausse trace historique.</small></div>
          </aside>
        </section>
      )}
    </main>
  );
}

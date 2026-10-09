'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation } from '@capgo/background-geolocation';
import type { BackgroundGeolocationPermissionStatus, Location as NativeLocation } from '@capgo/background-geolocation';
import { Geolocation } from '@capacitor/geolocation';
import { stopSharing } from '../lib/hunt';
import { supabase } from '../lib/supabase';

export type GpsState = 'off' | 'requesting' | 'active' | 'denied' | 'unavailable';
type GpsUpdate = { state: GpsState; accuracy: number | null; lastUpdate: number | null; errorMessage: string | null };
type LocationPayload = { room_id: string; user_id: string; latitude: number; longitude: number; accuracy: number; updated_at: string };
type WatchController = {
  start: (roomId: string, userId: string) => Promise<boolean>;
  stop: () => Promise<void>;
};
const { createLocationWatch } = require('../lib/location-watch.cjs') as {
  createLocationWatch: (options: {
    geolocation: Geolocation | null;
    writePosition: (position: LocationPayload) => Promise<void>;
    removePosition: (roomId: string) => Promise<void>;
    onUpdate: (update: GpsUpdate) => void;
  }) => WatchController;
};

type NativeSession = { roomId: string; userId: string; lastWriteAt: number; callback: (position?: NativeLocation, error?: { code?: string; message: string }) => void };
const LOCATION_RPC = process.env.NEXT_PUBLIC_SUPABASE_URL ? `${process.env.NEXT_PUBLIC_SUPABASE_URL.replace(/\/$/, '')}/rest/v1/rpc/publish_location` : '';

function getToken() {
  return supabase?.auth.getSession().then(({ data }) => data.session?.access_token ?? null) ?? Promise.resolve(null);
}

export function useGeolocation(roomId: string | undefined, userId: string) {
  const [state, setState] = useState<GpsState>('off');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controller = useRef<WatchController | null>(null);
  const nativeSession = useRef<NativeSession | null>(null);
  const sessionGeneration = useRef(0);
  const activeRoomId = useRef(roomId);
  const activeUserId = useRef(userId);
  const stopRef = useRef<() => Promise<void>>(async () => {});
  activeRoomId.current = roomId;
  activeUserId.current = userId;

  const getController = useCallback(() => {
    if (!controller.current) {
      const geolocation = typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null;
      controller.current = createLocationWatch({
        geolocation,
        writePosition: async (position) => {
          if (!supabase) throw new Error('Supabase indisponible.');
          const { error } = await supabase.from('positions').upsert(position);
          if (error) throw error;
        },
        removePosition: stopSharing,
        onUpdate: (update) => {
          setState(update.state);
          setAccuracy(update.accuracy);
          setLastUpdate(update.lastUpdate);
          setErrorMessage(update.errorMessage);
        },
      });
    }
    return controller.current;
  }, []);

  const stop = useCallback(async () => {
    const session = nativeSession.current;
    nativeSession.current = null;
    sessionGeneration.current += 1;
    if (Capacitor.isNativePlatform()) {
      try { await BackgroundGeolocation.stop(); } catch { /* Native tracking may already be stopped. */ }
    }
    if (session) {
      try {
        await stopSharing(session.roomId);
        setErrorMessage(null);
      } catch {
        setErrorMessage('Le dernier signal expirera automatiquement si sa suppression échoue.');
      }
    }
    if (controller.current) await controller.current.stop();
    setState('off');
    setAccuracy(null);
    setLastUpdate(null);
  }, []);
  stopRef.current = stop;

  useEffect(() => {
    if (nativeSession.current && nativeSession.current.roomId !== roomId) void stopRef.current();
    if (controller.current && !roomId) void controller.current.stop();
  }, [roomId]);

  useEffect(() => {
    if (state !== 'active' || lastUpdate === null) return;
    const expireAfter = Math.max(0, lastUpdate + 45_000 - Date.now());
    const timer = window.setTimeout(() => {
      if (Date.now() - lastUpdate < 45_000) return;
      setState('unavailable');
      setErrorMessage('Signal GPS périmé. Garde HUNT ouverte et attends une nouvelle position.');
    }, expireAfter);
    return () => window.clearTimeout(timer);
  }, [state, lastUpdate]);

  const start = useCallback(async () => {
    const currentRoom = activeRoomId.current;
    const currentUser = activeUserId.current;
    if (!currentRoom || !currentUser) {
      setErrorMessage('Rejoins un lobby avant de partager ta position.');
      setState('unavailable');
      return;
    }
    if (!Capacitor.isNativePlatform()) {
      await getController().start(currentRoom, currentUser);
      return;
    }
    if (nativeSession.current?.roomId === currentRoom && nativeSession.current.userId === currentUser) return;
    if (nativeSession.current) await stop();
    setState('requesting');
    setErrorMessage(null);

    const generation = ++sessionGeneration.current;
    const isCurrentRequest = () => generation === sessionGeneration.current
      && activeRoomId.current === currentRoom
      && activeUserId.current === currentUser;
    try {
      if (!supabase || !LOCATION_RPC) throw new Error('Le service de partie n’est pas configuré.');
      const initialToken = await getToken();
      if (!isCurrentRequest()) return;
      if (!initialToken) throw new Error('Reconnecte-toi avant d’activer le partage GPS.');

      const foregroundPermissions = await Geolocation.requestPermissions();
      if (!isCurrentRequest()) return;
      if (foregroundPermissions.location !== 'granted') throw Object.assign(new Error('Autorise la localisation précise pour partager ta balise pendant la partie.'), { code: 'NOT_AUTHORIZED' });

      let permissions: BackgroundGeolocationPermissionStatus;
      try { permissions = await BackgroundGeolocation.requestPermissions({ permissions: ['location'] }); }
      catch { permissions = await BackgroundGeolocation.checkPermissions(); }
      if (!isCurrentRequest()) return;
      if (permissions.location !== 'granted') throw Object.assign(new Error('Autorise la localisation pour démarrer le suivi de partie.'), { code: 'NOT_AUTHORIZED' });

      const session: NativeSession = { roomId: currentRoom, userId: currentUser, lastWriteAt: 0, callback: () => undefined };
      session.callback = (position, nativeError) => {
        if (nativeSession.current !== session || sessionGeneration.current !== generation) return;
        if (nativeError) {
          const denied = nativeError.code === 'NOT_AUTHORIZED' || nativeError.code === 'PERMISSION_DENIED';
          setState(denied ? 'denied' : 'unavailable');
          setErrorMessage(denied ? 'Autorisation refusée. Vérifie les réglages de localisation de HUNT.' : nativeError.message || 'Le GPS est momentanément indisponible.');
          return;
        }
        if (!position) return;
        void publishNativeLocation(position, session).catch(() => {
          if (nativeSession.current === session && sessionGeneration.current === generation) {
            setErrorMessage('Position reçue, mais la transmission au salon a échoué. Nouvelle tentative au prochain point GPS.');
          }
        });
      };
      nativeSession.current = session;

      const token = await getToken();
      if (!isCurrentRequest()) return;
      if (!token) throw new Error('La session a expiré. Reconnecte-toi puis réactive le partage GPS.');
      await BackgroundGeolocation.start({
        requestPermissions: false,
        stale: false,
        distanceFilter: 5,
        minIntervalMs: 4000,
        networkFallback: true,
        // publishNativeLocation sends callback fixes through an authenticated RPC;
        // the server resolves auth.uid() and checks salon membership before writing.
      }, session.callback);
      if (nativeSession.current !== session || !isCurrentRequest()) {
        await BackgroundGeolocation.stop();
        return;
      }
    } catch (nativeError) {
      if (!isCurrentRequest()) return;
      nativeSession.current = null;
      try { await BackgroundGeolocation.stop(); } catch { /* Nothing started. */ }
      const code = (nativeError as { code?: string })?.code;
      setState(code === 'NOT_AUTHORIZED' || code === 'BACKGROUND_PERMISSION_REQUIRED' ? 'denied' : 'unavailable');
      setErrorMessage(nativeError instanceof Error ? nativeError.message : 'Impossible de démarrer le partage GPS.');
    }
  }, [getController, stop]);

  async function publishNativeLocation(position: NativeLocation, session: NativeSession) {
    const fixAt = position.time && Math.abs(Date.now() - position.time) < 60_000 ? position.time : Date.now();
    if (fixAt - session.lastWriteAt < 2_500) return;
    session.lastWriteAt = fixAt;
    if (!supabase) return;
    if (Capacitor.isNativePlatform()) {
      const token = await getToken();
      if (!token || !LOCATION_RPC) {
        throw new Error('Reconnecte-toi pour transmettre ta position de partie.');
      }
      const response = await fetch(LOCATION_RPC, {
        method: 'POST',
        headers: {
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          p_room_id: session.roomId,
          p_latitude: position.latitude,
          p_longitude: position.longitude,
          p_accuracy: position.accuracy,
        }),
      });
      if (!response.ok) throw new Error('Le serveur n’a pas accepté la position.');
      if (nativeSession.current === session) {
        setState('active');
        setAccuracy(position.accuracy);
        setLastUpdate(fixAt);
        setErrorMessage(null);
      }
      return;
    }
    const payload: LocationPayload = {
      room_id: session.roomId,
      user_id: session.userId,
      latitude: position.latitude,
      longitude: position.longitude,
      accuracy: position.accuracy,
      updated_at: new Date(fixAt).toISOString(),
    };
    void supabase.from('positions').upsert(payload).then(({ error }) => {
      if (error && nativeSession.current === session) setErrorMessage('Position reçue, mais pas encore transmise. Le prochain point réessaiera.');
    });
  }

  useEffect(() => {
    return () => { void stopRef.current(); };
  }, []);

  return { state, accuracy, lastUpdate, errorMessage, start, stop };
}

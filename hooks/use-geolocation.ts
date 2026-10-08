'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { stopSharing } from '../lib/hunt';
import { supabase } from '../lib/supabase';

export type GpsState = 'off' | 'requesting' | 'active' | 'denied' | 'unavailable';

export function useGeolocation(roomId: string | undefined, userId: string) {
  const [state, setState] = useState<GpsState>('off');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const roomIdRef = useRef(roomId);
  const userIdRef = useRef(userId);

  useEffect(() => {
    if (roomIdRef.current !== roomId && watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      setState('off');
      setAccuracy(null);
      setLastUpdate(null);
      setErrorMessage(null);
      lastSentAt.current = 0;
    }
    roomIdRef.current = roomId;
    userIdRef.current = userId;
  }, [roomId, userId]);

  const stop = useCallback(async () => {
    if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    const currentRoom = roomIdRef.current;
    if (currentRoom && supabase) {
      try {
        await stopSharing(currentRoom);
      } catch {
        // The local GPS state still has to stop when the network is unavailable.
      }
    }
    setState('off');
    setAccuracy(null);
    setLastUpdate(null);
    setErrorMessage(null);
    lastSentAt.current = 0;
  }, []);

  const start = useCallback(() => {
    if (!roomIdRef.current || !userIdRef.current || typeof navigator === 'undefined' || !navigator.geolocation) {
      setErrorMessage('La localisation n’est pas disponible sur cet appareil.');
      setState('unavailable');
      return;
    }
    if (watchId.current !== null) return;

    setState('requesting');
    setErrorMessage(null);
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const currentRoom = roomIdRef.current;
        const currentUser = userIdRef.current;
        setState('active');
        setAccuracy(position.coords.accuracy);
        setLastUpdate(Date.now());
        setErrorMessage(null);
        if (!currentRoom || !supabase || Date.now() - lastSentAt.current < 2500) return;
        lastSentAt.current = Date.now();
        const { error } = await supabase.from('positions').upsert({
          room_id: currentRoom,
          user_id: currentUser,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          updated_at: new Date(position.timestamp).toISOString(),
        });
        if (error) {
          setErrorMessage('Le dernier signal n’a pas pu être transmis.');
          setState('unavailable');
        }
      },
      (error) => {
        if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
          navigator.geolocation.clearWatch(watchId.current);
          watchId.current = null;
        }
        if (error.code === error.PERMISSION_DENIED) {
          setErrorMessage('Autorisation refusée. Tu peux réessayer depuis le bouton ci-dessous.');
          setState('denied');
          return;
        }
        setErrorMessage(error.message || 'Signal GPS indisponible pour le moment.');
        setState('unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 },
    );
  }, []);

  useEffect(() => () => {
    if (watchId.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
  }, []);

  return { state, accuracy, lastUpdate, errorMessage, start, stop };
}

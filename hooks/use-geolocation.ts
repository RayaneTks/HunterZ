'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { stopSharing } from '../lib/hunt';
import { supabase } from '../lib/supabase';

export type GpsState = 'off' | 'requesting' | 'active' | 'denied' | 'unavailable';

export function useGeolocation(roomId: string | undefined, userId: string) {
  const [state, setState] = useState<GpsState>('off');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const watchId = useRef<number | null>(null);
  const lastSentAt = useRef(0);
  const roomIdRef = useRef(roomId);
  const userIdRef = useRef(userId);

  useEffect(() => {
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
  }, []);

  const start = useCallback(() => {
    if (!roomIdRef.current || !userIdRef.current || typeof navigator === 'undefined' || !navigator.geolocation) {
      setState('unavailable');
      return;
    }
    if (watchId.current !== null) return;

    setState('requesting');
    watchId.current = navigator.geolocation.watchPosition(
      async (position) => {
        const currentRoom = roomIdRef.current;
        const currentUser = userIdRef.current;
        setState('active');
        setAccuracy(position.coords.accuracy);
        setLastUpdate(Date.now());
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
        if (error) setState('unavailable');
      },
      (error) => {
        setState(error.code === error.PERMISSION_DENIED ? 'denied' : 'unavailable');
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
    );
  }, []);

  useEffect(() => () => {
    if (watchId.current !== null && navigator.geolocation) navigator.geolocation.clearWatch(watchId.current);
  }, []);

  return { state, accuracy, lastUpdate, start, stop };
}

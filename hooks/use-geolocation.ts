'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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

export function useGeolocation(roomId: string | undefined, userId: string) {
  const [state, setState] = useState<GpsState>('off');
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const controller = useRef<WatchController | null>(null);
  const mounted = useRef(true);
  const roomIdRef = useRef(roomId);
  const userIdRef = useRef(userId);
  roomIdRef.current = roomId;
  userIdRef.current = userId;

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
          if (!mounted.current) return;
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
    if (!controller.current) {
      setState('off');
      setAccuracy(null);
      setLastUpdate(null);
      setErrorMessage(null);
      return;
    }
    await controller.current.stop();
  }, []);

  const start = useCallback(async () => {
    const currentRoom = roomIdRef.current;
    const currentUser = userIdRef.current;
    if (!currentRoom || !currentUser) {
      setErrorMessage('Rejoins un lobby avant de partager ta position.');
      setState('unavailable');
      return;
    }
    await getController().start(currentRoom, currentUser);
  }, [getController]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      void controller.current?.stop();
    };
  }, []);

  return { state, accuracy, lastUpdate, errorMessage, start, stop };
}

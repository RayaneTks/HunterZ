'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type Map as MapInstance, type Marker } from 'maplibre-gl';
import type { PlayerLocation } from '../lib/types';

export default function MapView({ locations, me, recenterSignal }: { locations: PlayerLocation[]; me: string; recenterSignal: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const markers = useRef<Marker[]>([]);
  const centeredOnOwnPosition = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [2.35, 48.86],
      zoom: 12,
    });
    instance.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    map.current = instance;
    return () => {
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = locations.map((player) => {
      const wrapper = document.createElement('div');
      wrapper.className = `marker-wrap${player.user_id === me ? ' self' : ''}`;
      const ring = document.createElement('div');
      ring.className = 'accuracy-ring';
      ring.style.width = `${Math.min(104, Math.max(46, (player.accuracy ?? 30) * 1.3))}px`;
      ring.style.height = ring.style.width;
      const markerElement = document.createElement('div');
      markerElement.className = 'map-marker';
      markerElement.textContent = player.nickname.slice(0, 1).toUpperCase();
      wrapper.append(ring, markerElement);
      return new maplibregl.Marker({ element: wrapper })
        .setLngLat([player.longitude, player.latitude])
        .setPopup(new maplibregl.Popup({ offset: 22 }).setText(`${player.nickname} · précision ±${Math.round(player.accuracy ?? 0)} m`))
        .addTo(map.current!);
    });
  }, [locations, me]);

  useEffect(() => {
    const own = locations.find((player) => player.user_id === me);
    if (!own || !map.current) return;
    if (!centeredOnOwnPosition.current) {
      map.current.flyTo({ center: [own.longitude, own.latitude], zoom: 16, duration: 900 });
      centeredOnOwnPosition.current = true;
    }
  }, [locations, me]);

  useEffect(() => {
    if (!recenterSignal || !map.current) return;
    const own = locations.find((player) => player.user_id === me);
    if (own) map.current.flyTo({ center: [own.longitude, own.latitude], zoom: 16, duration: 700 });
  }, [locations, me, recenterSignal]);

  return <div ref={container} className="map" aria-label="Carte des joueurs du lobby" />;
}

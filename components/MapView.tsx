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
  const fittedToSquad = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    const instance = new maplibregl.Map({
      container: container.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [5.3698, 43.2965],
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
      wrapper.setAttribute('role', 'img');
      wrapper.setAttribute('aria-label', `${player.nickname}, précision de ${Math.round(player.accuracy ?? 0)} mètres`);
      const ring = document.createElement('div');
      ring.className = 'accuracy-ring';
      ring.style.width = `${Math.min(104, Math.max(46, (player.accuracy ?? 30) * 1.3))}px`;
      ring.style.height = ring.style.width;
      const markerElement = document.createElement('div');
      markerElement.className = 'map-marker';
      const glyph = document.createElement('span');
      glyph.textContent = player.nickname.slice(0, 1).toUpperCase();
      markerElement.append(glyph);
      wrapper.append(ring, markerElement);
      return new maplibregl.Marker({ element: wrapper })
        .setLngLat([player.longitude, player.latitude])
        .setPopup(new maplibregl.Popup({ offset: 22 }).setText(`${player.nickname} · précision ±${Math.round(player.accuracy ?? 0)} m`))
        .addTo(map.current!);
    });
  }, [locations, me]);

  useEffect(() => {
    const own = locations.find((player) => player.user_id === me);
    if (!map.current || locations.length === 0) return;
    if (locations.length > 1 && !fittedToSquad.current) {
      const bounds = new maplibregl.LngLatBounds();
      locations.forEach((player) => bounds.extend([player.longitude, player.latitude]));
      map.current.fitBounds(bounds, { padding: 72, maxZoom: 16, duration: 800 });
      fittedToSquad.current = true;
      return;
    }
    if (!own) return;
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

'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type Map as MapInstance, type Marker } from 'maplibre-gl';
import type { PlayerLocation } from '../lib/types';

type PlayerMarker = { marker: Marker; player: PlayerLocation };

function resizeAccuracyRing(record: PlayerMarker, zoom: number) {
  const ring = record.marker.getElement().querySelector<HTMLElement>('.accuracy-ring');
  if (!ring) return;
  const accuracy = record.player.accuracy;
  ring.hidden = accuracy == null;
  const metersPerPixel = 40075016.686 * Math.cos(record.player.latitude * Math.PI / 180) / Math.pow(2, zoom + 9);
  ring.style.width = `${Math.min(1200, Math.max(0, (accuracy ?? 0) * 2 / metersPerPixel))}px`;
  ring.style.height = ring.style.width;
}

export default function MapView({ locations, me, recenterSignal }: { locations: PlayerLocation[]; me: string; recenterSignal: number }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const markers = useRef(new Map<string, PlayerMarker>());
  const centeredOnOwnPosition = useRef(false);
  const fittedToSquad = useRef(false);
  const lastRecenterSignal = useRef(0);
  const reduceMotion = useRef(false);

  useEffect(() => {
    if (!container.current || map.current) return;
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const instance = new maplibregl.Map({
      container: container.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [5.3698, 43.2965],
      zoom: 13.5,
    });
    map.current = instance;
    const mapContainer = container.current;
    const sheet = mapContainer.closest('.lobby-view')?.querySelector('.squad-sheet');
    const resize = () => {
      const height = mapContainer.clientHeight;
      const sheetRect = sheet?.getBoundingClientRect();
      instance.resize();
      instance.setPadding(window.innerWidth < 800
        ? { top: Math.min(160, height * .23), bottom: Math.min((sheetRect?.height ?? height * .4) + 16, height * .7), left: 24, right: 24 }
        : { top: 100, bottom: 40, left: 40, right: (sheetRect?.width ?? 340) + 56 });
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mapContainer);
    if (sheet) observer.observe(sheet);
    resize();
    const resizeRings = () => markers.current.forEach((record) => resizeAccuracyRing(record, instance.getZoom()));
    instance.on('zoom', resizeRings);
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updateMotion = () => { reduceMotion.current = motionQuery.matches; };
    motionQuery.addEventListener('change', updateMotion);
    return () => {
      observer.disconnect();
      motionQuery.removeEventListener('change', updateMotion);
      markers.current.forEach((record) => record.marker.remove());
      markers.current.clear();
      instance.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap) return;
    const currentPlayers = new Set(locations.map((player) => player.user_id));
    markers.current.forEach((record, id) => {
      if (!currentPlayers.has(id)) {
        record.marker.remove();
        markers.current.delete(id);
      }
    });
    locations.forEach((player) => {
      let record = markers.current.get(player.user_id);
      const precision = player.accuracy == null ? 'inconnue' : `±${Math.round(player.accuracy)} m`;
      if (!record) {
        const wrapper = document.createElement('button');
        wrapper.type = 'button';
        const ring = document.createElement('div');
        ring.className = 'accuracy-ring';
        const markerElement = document.createElement('div');
        markerElement.className = 'map-marker';
        const glyph = document.createElement('span');
        markerElement.append(glyph);
        wrapper.append(ring, markerElement);
        const marker = new maplibregl.Marker({ element: wrapper })
          .setLngLat([player.longitude, player.latitude])
          .setPopup(new maplibregl.Popup({ offset: 22 }).setText(''))
          .addTo(currentMap);
        record = { marker, player };
        markers.current.set(player.user_id, record);
      }
      record.player = player;
      const element = record.marker.getElement();
      element.className = `marker-wrap${player.user_id === me ? ' self' : ''}`;
      element.setAttribute('aria-label', `Voir ${player.nickname}, précision ${precision}`);
      const glyph = element.querySelector('.map-marker span');
      if (glyph) glyph.textContent = player.nickname.slice(0, 1).toUpperCase();
      record.marker.setLngLat([player.longitude, player.latitude]);
      record.marker.getPopup()?.setText(`${player.nickname} · précision ${precision}`);
      resizeAccuracyRing(record, currentMap.getZoom());
    });
  }, [locations, me]);

  useEffect(() => {
    const currentMap = map.current;
    const own = locations.find((player) => player.user_id === me);
    if (!currentMap || locations.length === 0) return;
    if (locations.length > 1 && !fittedToSquad.current) {
      const bounds = new maplibregl.LngLatBounds();
      locations.forEach((player) => bounds.extend([player.longitude, player.latitude]));
      currentMap.fitBounds(bounds, { padding: currentMap.getPadding(), maxZoom: 16, duration: reduceMotion.current ? 0 : 600 });
      fittedToSquad.current = true;
      centeredOnOwnPosition.current = Boolean(own);
      return;
    }
    if (own && !centeredOnOwnPosition.current) {
      currentMap.flyTo({ center: [own.longitude, own.latitude], zoom: 16, duration: reduceMotion.current ? 0 : 600 });
      centeredOnOwnPosition.current = true;
    }
  }, [locations, me]);

  useEffect(() => {
    if (!recenterSignal || recenterSignal === lastRecenterSignal.current || !map.current) return;
    const own = locations.find((player) => player.user_id === me);
    if (!own) return;
    lastRecenterSignal.current = recenterSignal;
    map.current.flyTo({ center: [own.longitude, own.latitude], zoom: 16, duration: reduceMotion.current ? 0 : 600 });
  }, [locations, me, recenterSignal]);

  return <div ref={container} className="map" aria-label="Carte des joueurs du lobby" />;
}

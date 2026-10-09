'use client';

import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import { type GeoJSONSource, type Map as MapInstance, type Marker } from 'maplibre-gl';
import type { HuntZone, PlayerLocation } from '../lib/types';

type PlayerMarker = { marker: Marker; player: PlayerLocation };

function circleFeature(zone: HuntZone | null): GeoJSON.FeatureCollection {
  if (!zone) return { type: 'FeatureCollection', features: [] };
  const earthRadius = 6_371_008.8;
  const angularRadius = zone.radiusMeters / earthRadius;
  const centerLatitude = zone.latitude * Math.PI / 180;
  const centerLongitude = zone.longitude * Math.PI / 180;
  const coordinates: [number, number][] = [];
  for (let index = 0; index <= 64; index += 1) {
    const bearing = index / 64 * Math.PI * 2;
    const latitude = Math.asin(
      Math.sin(centerLatitude) * Math.cos(angularRadius)
      + Math.cos(centerLatitude) * Math.sin(angularRadius) * Math.cos(bearing),
    );
    const longitude = centerLongitude + Math.atan2(
      Math.sin(bearing) * Math.sin(angularRadius) * Math.cos(centerLatitude),
      Math.cos(angularRadius) - Math.sin(centerLatitude) * Math.sin(latitude),
    );
    coordinates.push([longitude * 180 / Math.PI, latitude * 180 / Math.PI]);
  }
  return {
    type: 'FeatureCollection',
    features: [
      { type: 'Feature', properties: { kind: 'boundary' }, geometry: { type: 'Polygon', coordinates: [coordinates] } },
      { type: 'Feature', properties: { kind: 'center' }, geometry: { type: 'Point', coordinates: [zone.longitude, zone.latitude] } },
    ],
  };
}

function formatSignalAge(updatedAt: string) {
  const timestamp = Date.parse(updatedAt);
  if (!Number.isFinite(timestamp) || timestamp > Date.now()) return 'horodatage invalide';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  return seconds < 5 ? 'à l’instant' : `il y a ${seconds < 60 ? `${seconds} s` : `${Math.floor(seconds / 60)} min`}`;
}

function resizeAccuracyRing(record: PlayerMarker, zoom: number) {
  const ring = record.marker.getElement().querySelector<HTMLElement>('.accuracy-ring');
  if (!ring) return;
  const accuracy = record.player.accuracy;
  ring.hidden = accuracy == null;
  const metersPerPixel = 40075016.686 * Math.cos(record.player.latitude * Math.PI / 180) / Math.pow(2, zoom + 9);
  ring.style.width = `${Math.min(1200, Math.max(0, (accuracy ?? 0) * 2 / metersPerPixel))}px`;
  ring.style.height = ring.style.width;
}

export default function MapView({ locations, me, recenterSignal, focusedPlayerId, onSelectPlayer, zone = null, onMapTap, onMapCenterChange, placementMode = false }: { locations: PlayerLocation[]; me: string; recenterSignal: number; focusedPlayerId: string | null; onSelectPlayer: (playerId: string) => void; zone?: HuntZone | null; onMapTap?: (center: { latitude: number; longitude: number }) => void; onMapCenterChange?: (center: { latitude: number; longitude: number }) => void; placementMode?: boolean }) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MapInstance | null>(null);
  const markers = useRef(new Map<string, PlayerMarker>());
  const centeredOnOwnPosition = useRef(false);
  const fittedToSquad = useRef(false);
  const userMapMotion = useRef(false);
  const lastRecenterSignal = useRef(0);
  const reduceMotion = useRef(false);
  const selectPlayerRef = useRef(onSelectPlayer);
  selectPlayerRef.current = onSelectPlayer;
  const onMapTapRef = useRef(onMapTap);
  onMapTapRef.current = onMapTap;
  const onMapCenterChangeRef = useRef(onMapCenterChange);
  onMapCenterChangeRef.current = onMapCenterChange;
  const placementModeRef = useRef(placementMode);
  placementModeRef.current = placementMode;
  const zoneRef = useRef(zone);
  zoneRef.current = zone;
  const fittedZoneRef = useRef('');

  useEffect(() => {
    if (!container.current || map.current) return;
    maplibregl.setWorkerUrl(new URL('maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url).toString());
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const instance = new maplibregl.Map({
      container: container.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [5.3698, 43.2965],
      zoom: 13.5,
      cooperativeGestures: false,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false,
    });
    map.current = instance;
    instance.on('click', (event) => onMapTapRef.current?.({ latitude: event.lngLat.lat, longitude: event.lngLat.lng }));
    instance.on('movestart', (event) => {
      if ((event as { originalEvent?: Event }).originalEvent) userMapMotion.current = true;
    });
    instance.on('moveend', () => {
      if (!placementModeRef.current || !userMapMotion.current) return;
      userMapMotion.current = false;
      const center = instance.getCenter();
      onMapCenterChangeRef.current?.({ latitude: center.lat, longitude: center.lng });
    });
    instance.on('load', () => {
      instance.addSource('hunt-zone', { type: 'geojson', data: circleFeature(zoneRef.current) });
      instance.addLayer({
        id: 'hunt-zone-fill', type: 'fill', source: 'hunt-zone', filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'fill-color': '#f05a50', 'fill-opacity': 0.08 },
      });
      instance.addLayer({
        id: 'hunt-zone-outline', type: 'line', source: 'hunt-zone', filter: ['==', ['geometry-type'], 'Polygon'],
        paint: { 'line-color': '#f05a50', 'line-width': 3, 'line-opacity': 0.9, 'line-dasharray': [2, 1.3] },
      });
      instance.addLayer({
        id: 'hunt-zone-center', type: 'circle', source: 'hunt-zone', filter: ['==', ['geometry-type'], 'Point'],
        paint: { 'circle-radius': 6, 'circle-color': '#f05a50', 'circle-stroke-color': '#f3efe6', 'circle-stroke-width': 2 },
      });
      const initialZone = zoneRef.current;
      if (initialZone) {
        const latitudeDelta = initialZone.radiusMeters / 111_000;
        const longitudeDelta = initialZone.radiusMeters / (111_000 * Math.max(0.2, Math.cos(initialZone.latitude * Math.PI / 180)));
        instance.fitBounds(
          [[initialZone.longitude - longitudeDelta, initialZone.latitude - latitudeDelta], [initialZone.longitude + longitudeDelta, initialZone.latitude + latitudeDelta]],
          { padding: instance.getPadding(), maxZoom: 15, duration: reduceMotion.current ? 0 : 500 },
        );
        fittedZoneRef.current = `${initialZone.latitude}:${initialZone.longitude}:${initialZone.radiusMeters}`;
      }
    });
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
    if (!placementMode || !map.current) return;
    userMapMotion.current = false;
    fittedToSquad.current = true;
    centeredOnOwnPosition.current = true;
    const center = map.current.getCenter();
    onMapCenterChangeRef.current?.({ latitude: center.lat, longitude: center.lng });
  }, [placementMode]);

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || !currentMap.isStyleLoaded()) return;
    const source = currentMap.getSource('hunt-zone') as GeoJSONSource | undefined;
    source?.setData(circleFeature(zone));
    if (!zone) {
      fittedZoneRef.current = '';
      return;
    }
    if (placementModeRef.current) return;
    const signature = `${zone.latitude}:${zone.longitude}:${zone.radiusMeters}`;
    if (signature === fittedZoneRef.current) return;
    fittedZoneRef.current = signature;
    const latitudeDelta = zone.radiusMeters / 111_000;
    const longitudeDelta = zone.radiusMeters / (111_000 * Math.max(0.2, Math.cos(zone.latitude * Math.PI / 180)));
    currentMap.fitBounds(
      [[zone.longitude - longitudeDelta, zone.latitude - latitudeDelta], [zone.longitude + longitudeDelta, zone.latitude + latitudeDelta]],
      { padding: currentMap.getPadding(), maxZoom: 15, duration: reduceMotion.current ? 0 : 500 },
    );
  }, [zone]);

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
        wrapper.addEventListener('click', () => selectPlayerRef.current(player.user_id));
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
      element.className = `marker-wrap${player.user_id === me ? ' self' : ''}${player.user_id === focusedPlayerId ? ' selected' : ''}`;
      element.setAttribute('aria-label', `Voir ${player.nickname}, précision ${precision}`);
      const glyph = element.querySelector('.map-marker span');
      if (glyph) glyph.textContent = player.nickname.slice(0, 1).toUpperCase();
      record.marker.setLngLat([player.longitude, player.latitude]);
      record.marker.getPopup()?.setText(`${player.nickname} · précision ${precision} · ${formatSignalAge(player.updated_at)}`);
      resizeAccuracyRing(record, currentMap.getZoom());
    });
  }, [locations, me, focusedPlayerId, onSelectPlayer]);

  useEffect(() => {
    const currentMap = map.current;
    const own = locations.find((player) => player.user_id === me);
    if (!currentMap || placementModeRef.current || locations.length === 0) return;
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
    if (!recenterSignal || recenterSignal === lastRecenterSignal.current || !map.current || placementModeRef.current) return;
    const own = locations.find((player) => player.user_id === me);
    if (!own) return;
    lastRecenterSignal.current = recenterSignal;
    map.current.flyTo({ center: [own.longitude, own.latitude], zoom: 16, duration: reduceMotion.current ? 0 : 600 });
  }, [locations, me, recenterSignal]);

  useEffect(() => {
    const currentMap = map.current;
    if (!currentMap || placementModeRef.current || !focusedPlayerId) return;
    const player = locations.find((location) => location.user_id === focusedPlayerId);
    if (!player) return;
    currentMap.flyTo({ center: [player.longitude, player.latitude], zoom: Math.max(currentMap.getZoom(), 16), duration: reduceMotion.current ? 0 : 500 });
  }, [focusedPlayerId, locations]);

  return <>
    <div ref={container} className="map" aria-label="Carte des joueurs et du terrain du lobby" />
    {placementMode && <div className="map-center-reticle" aria-hidden="true"><span /><span /><span /><span /></div>}
  </>;
}

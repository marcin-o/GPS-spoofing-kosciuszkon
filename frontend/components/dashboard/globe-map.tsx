"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { type LatLngExpression, type LatLngTuple } from "leaflet";
import type { AircraftEntry } from "@/lib/types";

interface GlobeMapProps {
  aircraft: AircraftEntry[];
  selected: string | null;
  onSelect: (icao: string) => void;
}

const COLORS = {
  OK: "#34d399",
  WARNING: "#fbbf24",
  CRITICAL: "#ef4444",
};

const EUROPE_CENTER: LatLngTuple = [54, 18];

// Plane SVG (north-pointing). Rotation applied via wrapper div.
const PLANE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"
     fill="currentColor" stroke="rgba(0,0,0,0.55)" stroke-width="0.5" stroke-linejoin="round">
  <path d="M12 2 L13.6 11 L22 13.4 L22 14.6 L13.6 13.4 L13 19.5 L15.6 21 L15.6 22 L12 21.2 L8.4 22 L8.4 21 L11 19.5 L10.4 13.4 L2 14.6 L2 13.4 L10.4 11 Z"/>
</svg>`;

function planeIcon(verdict: keyof typeof COLORS, heading: number, selected: boolean): L.DivIcon {
  const color = COLORS[verdict];
  const ring = selected
    ? `box-shadow: 0 0 0 2px ${color}, 0 0 12px 2px ${color}80;`
    : "";
  const pulse = verdict === "CRITICAL"
    ? `<span class="gnss-pulse" style="--c:${color}"></span>`
    : "";
  const html = `
    <div class="gnss-plane-marker" style="transform: rotate(${heading}deg); color: ${color}; ${ring}">
      ${PLANE_SVG}
      ${pulse}
    </div>`;
  return L.divIcon({
    html,
    className: "gnss-plane-icon",
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  });
}

export default function GlobeMap({ aircraft, selected, onSelect }: GlobeMapProps) {
  return (
    <MapContainer
      center={EUROPE_CENTER}
      zoom={5}
      className="h-full w-full bg-slate-950"
      style={{ background: "#0a0e1a" }}
      preferCanvas={false}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors / © CARTO"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      />
      <FocusOnSelected aircraft={aircraft} selected={selected} />
      {aircraft.map((a) => (
        <PlaneMarker
          key={a.icao24}
          a={a}
          selected={a.icao24 === selected}
          onSelect={onSelect}
        />
      ))}
    </MapContainer>
  );
}

function PlaneMarker({
  a,
  selected,
  onSelect,
}: {
  a: AircraftEntry;
  selected: boolean;
  onSelect: (icao: string) => void;
}) {
  const icon = useMemo(
    () => planeIcon(a.verdict, a.position.true_track, selected),
    [a.verdict, a.position.true_track, selected],
  );
  return (
    <Marker
      position={[a.position.lat, a.position.lon] as LatLngExpression}
      icon={icon}
      eventHandlers={{ click: () => onSelect(a.icao24) }}
    >
      <Tooltip direction="top" offset={[0, -14]} opacity={1}>
        <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
          <strong>{a.callsign}</strong>
          <br />
          {a.verdict} · {a.ensemble_score.ratio.toFixed(2)}×
          <br />
          {a.position.velocity.toFixed(0)} kt · hdg {a.position.true_track.toFixed(0)}°
        </div>
      </Tooltip>
    </Marker>
  );
}

function FocusOnSelected({
  aircraft,
  selected,
}: {
  aircraft: AircraftEntry[];
  selected: string | null;
}) {
  const map = useMap();
  const lastFocused = useRef<string | null>(null);

  useEffect(() => {
    if (!selected) return;
    const ac = aircraft.find((a) => a.icao24 === selected);
    if (!ac) return;
    if (lastFocused.current === selected) return;
    lastFocused.current = selected;
    map.setView([ac.position.lat, ac.position.lon], Math.max(map.getZoom(), 6), {
      animate: true,
    });
  }, [aircraft, selected, map]);

  return null;
}

"use client";

import { useEffect, useMemo, useRef } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { type LatLngExpression, type LatLngTuple } from "leaflet";
import type { Verdict } from "@/lib/types";

const EUROPE_CENTER: LatLngTuple = [54, 18];

const COLORS: Record<Verdict, string> = {
  OK: "#34d399",
  WARNING: "#fbbf24",
  CRITICAL: "#ef4444",
};

const PLANE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22"
     fill="currentColor" stroke="rgba(0,0,0,0.55)" stroke-width="0.5" stroke-linejoin="round">
  <path d="M12 2 L13.6 11 L22 13.4 L22 14.6 L13.6 13.4 L13 19.5 L15.6 21 L15.6 22 L12 21.2 L8.4 22 L8.4 21 L11 19.5 L10.4 13.4 L2 14.6 L2 13.4 L10.4 11 Z"/>
</svg>`;

function planeIcon(verdict: Verdict, heading: number, selected: boolean): L.DivIcon {
  const color = COLORS[verdict];
  const ring = selected ? `box-shadow: 0 0 0 2px ${color}, 0 0 12px 2px ${color}80;` : "";
  const html = `
    <div class="gnss-plane-marker" style="transform: rotate(${heading}deg); color: ${color}; ${ring}">
      ${PLANE_SVG}
    </div>`;
  return L.divIcon({ html, className: "gnss-plane-icon", iconSize: [28, 28], iconAnchor: [14, 14] });
}

export interface AircraftTrail {
  icao24: string;
  callsign: string;
  trail: LatLngTuple[];
  currentPos: LatLngTuple;
  heading: number;
  verdict: Verdict;
  selected?: boolean;
}

interface ReplayMapProps {
  aircraft: AircraftTrail[];
  onSelect?: (icao24: string) => void;
  initialCenter?: LatLngTuple;
  initialZoom?: number;
}

export function ReplayMap({
  aircraft,
  onSelect,
  initialCenter = EUROPE_CENTER,
  initialZoom = 5,
}: ReplayMapProps) {
  return (
    <MapContainer
      center={initialCenter}
      zoom={initialZoom}
      className="h-full w-full"
      style={{ background: "#0a0e1a" }}
      preferCanvas={false}
    >
      <TileLayer
        attribution="© OpenStreetMap contributors / © CARTO"
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
      />
      <FocusSelected aircraft={aircraft} />
      {aircraft.map((ac) => (
        <AircraftLayer key={ac.icao24} ac={ac} onSelect={onSelect} />
      ))}
    </MapContainer>
  );
}

function AircraftLayer({
  ac,
  onSelect,
}: {
  ac: AircraftTrail;
  onSelect?: (icao24: string) => void;
}) {
  const color = COLORS[ac.verdict];
  const icon = useMemo(
    () => planeIcon(ac.verdict, ac.heading, !!ac.selected),
    [ac.verdict, ac.heading, ac.selected],
  );

  return (
    <>
      {ac.trail.length >= 2 && (
        <Polyline
          positions={ac.trail as LatLngExpression[]}
          pathOptions={{
            color,
            weight: ac.selected ? 2.5 : 1.5,
            opacity: ac.selected ? 0.9 : 0.5,
            dashArray: ac.verdict === "OK" ? "4 4" : undefined,
          }}
        />
      )}
      <Marker
        position={ac.currentPos as LatLngExpression}
        icon={icon}
        eventHandlers={{ click: () => onSelect?.(ac.icao24) }}
      >
        <Tooltip direction="top" offset={[0, -14]} opacity={1}>
          <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
            <strong>{ac.callsign}</strong>
            <br />
            {ac.verdict}
          </div>
        </Tooltip>
      </Marker>
    </>
  );
}

function FocusSelected({ aircraft }: { aircraft: AircraftTrail[] }) {
  const map = useMap();
  const lastFocused = useRef<string | null>(null);

  useEffect(() => {
    const sel = aircraft.find((a) => a.selected);
    if (!sel) return;
    if (lastFocused.current === sel.icao24) return;
    lastFocused.current = sel.icao24;
    map.setView(sel.currentPos, Math.max(map.getZoom(), 6), { animate: true });
  }, [aircraft, map]);

  return null;
}

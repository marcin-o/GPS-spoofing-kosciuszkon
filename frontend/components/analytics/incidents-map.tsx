"use client";

import { useEffect, useState } from "react";
import { MapContainer, Marker, TileLayer, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L, { type LatLngExpression, type LatLngTuple } from "leaflet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getIncidents } from "@/lib/api";
import type { Incident } from "@/lib/types";

const WORLD_CENTER: LatLngTuple = [40, 30];

const PIN_HTML = `
  <div style="
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #EE3124;
    border: 2px solid rgba(238,49,36,0.4);
    box-shadow: 0 0 0 4px rgba(238,49,36,0.2), 0 0 16px rgba(238,49,36,0.6);
  "></div>
`;

const incidentIcon = L.divIcon({
  html: PIN_HTML,
  className: "incident-pin",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

export function IncidentsMap() {
  const [incidents, setIncidents] = useState<Incident[] | null>(null);

  useEffect(() => {
    getIncidents().then(setIncidents);
  }, []);

  return (
    <Card className="border-slate-800 bg-slate-900/50 gap-2 py-3 h-full">
      <CardHeader className="px-4 gap-1">
        <CardTitle className="flex items-center gap-2 text-sm text-slate-200">
          <MapPin className="h-4 w-4 text-[#EE3124]" />
          Incidents map
        </CardTitle>
        <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono">
          Historical GPS spoofing events
        </span>
      </CardHeader>
      <CardContent className="px-3 pb-3 flex-1">
        {!incidents ? (
          <Skeleton className="h-[280px] w-full rounded-md" />
        ) : (
          <div className="h-[280px] w-full rounded-md overflow-hidden border border-slate-800">
            <MapContainer
              center={WORLD_CENTER}
              zoom={2}
              scrollWheelZoom={false}
              className="h-full w-full"
              style={{ background: "#0a0e1a" }}
            >
              <TileLayer
                attribution="© OpenStreetMap contributors / © CARTO"
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
              />
              {incidents.map((inc) => {
                if (inc.lat == null || inc.lon == null) return null;
                return (
                  <Marker
                    key={inc.id}
                    position={[inc.lat, inc.lon] as LatLngExpression}
                    icon={incidentIcon}
                  >
                    <Tooltip direction="top" offset={[0, -8]} opacity={1}>
                      <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11 }}>
                        <strong>{inc.title}</strong>
                        <br />
                        {inc.date}
                        <br />
                        <span style={{ color: "#94a3b8" }}>{inc.region}</span>
                      </div>
                    </Tooltip>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

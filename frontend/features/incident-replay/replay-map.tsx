"use client";

import { useEffect, useRef } from "react";
import { mapboxgl, DEFAULT_STYLE, HAS_MAPBOX_TOKEN } from "@/lib/mapbox";
import type { IncidentReplay } from "@/lib/api/types";
import { Card, CardContent } from "@/components/ui/card";

const SRC_REAL = "trajectory-real";
const SRC_REPORTED = "trajectory-reported";
const SRC_CURSOR = "trajectory-cursor";

export function ReplayMap({
  replay,
  frameIndex,
}: {
  replay: IncidentReplay | null;
  frameIndex: number;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  useEffect(() => {
    if (!HAS_MAPBOX_TOKEN || !containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      projection: "mercator",
      center: [50, 35],
      zoom: 4,
      pitch: 30,
      attributionControl: false,
      antialias: true,
    });
    mapRef.current = map;

    map.on("style.load", () => {
      const empty = {
        type: "FeatureCollection" as const,
        features: [] as never[],
      };
      map.addSource(SRC_REAL, { type: "geojson", data: empty });
      map.addSource(SRC_REPORTED, { type: "geojson", data: empty });
      map.addSource(SRC_CURSOR, { type: "geojson", data: empty });

      map.addLayer({
        id: SRC_REAL,
        type: "line",
        source: SRC_REAL,
        paint: {
          "line-color": "#10b981",
          "line-width": 3,
          "line-dasharray": [2, 2],
        },
      });
      map.addLayer({
        id: SRC_REPORTED,
        type: "line",
        source: SRC_REPORTED,
        paint: { "line-color": "#ef4444", "line-width": 3 },
      });
      map.addLayer({
        id: `${SRC_CURSOR}-glow`,
        type: "circle",
        source: SRC_CURSOR,
        paint: {
          "circle-radius": 14,
          "circle-color": "#ef4444",
          "circle-opacity": 0.25,
          "circle-blur": 0.6,
        },
      });
      map.addLayer({
        id: SRC_CURSOR,
        type: "circle",
        source: SRC_CURSOR,
        paint: {
          "circle-radius": 6,
          "circle-color": "#ef4444",
          "circle-stroke-color": "#0f172a",
          "circle-stroke-width": 2,
        },
      });

      readyRef.current = true;
    });

    return () => {
      readyRef.current = false;
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !replay || !readyRef.current) return;

    const realCoords = replay.frames.map((f) => [f.lon_real, f.lat_real]);
    const reportedCoords = replay.frames.map((f) => [
      f.lon_reported,
      f.lat_reported,
    ]);

    (map.getSource(SRC_REAL) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: realCoords },
        },
      ],
    });
    (map.getSource(SRC_REPORTED) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "LineString", coordinates: reportedCoords },
        },
      ],
    });

    const all: [number, number][] = [
      ...realCoords,
      ...reportedCoords,
    ] as [number, number][];
    const lats = all.map((c) => c[1]);
    const lons = all.map((c) => c[0]);
    const sw: [number, number] = [Math.min(...lons), Math.min(...lats)];
    const ne: [number, number] = [Math.max(...lons), Math.max(...lats)];
    map.fitBounds([sw, ne], { padding: 80, duration: 1500, pitch: 35 });
  }, [replay]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !replay || !readyRef.current) return;
    const f = replay.frames[frameIndex];
    if (!f) return;
    (map.getSource(SRC_CURSOR) as mapboxgl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: { type: "Point", coordinates: [f.lon_reported, f.lat_reported] },
        },
      ],
    });
  }, [replay, frameIndex]);

  if (!HAS_MAPBOX_TOKEN) {
    return (
      <Card className="flex-1">
        <CardContent className="p-6 text-sm text-muted-foreground">
          Replay map needs <code className="font-mono">NEXT_PUBLIC_MAPBOX_TOKEN</code>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px] rounded-lg overflow-hidden border border-border/60 bg-slate-950"
      aria-label="Incident trajectory map"
    />
  );
}

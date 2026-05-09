"use client";

import { useCallback, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  mapboxgl,
  DEFAULT_STYLE,
  CAMERA_POSITIONS,
  type CameraPosition,
} from "@/lib/mapbox";
import { boundsToBBox } from "@/lib/bbox";
import type { BBox } from "@/lib/api/types";
import {
  ensureAircraftLayers,
  AIRCRAFT_DOT_LAYER,
  startAircraftPulse,
} from "./layers/aircraft-layer";

type UseGlobeMapOpts = {
  onAircraftClick?: (icao24: string) => void;
};

export function useGlobeMap({ onAircraftClick }: UseGlobeMapOpts) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const [bbox, setBbox] = useState<BBox | null>(null);

  const fireClick = useEffectEvent((id: string) => {
    onAircraftClick?.(id);
  });

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: DEFAULT_STYLE,
      projection: "globe",
      ...CAMERA_POSITIONS.middleEast,
      attributionControl: false,
      antialias: true,
    });

    mapRef.current = map;

    map.on("style.load", () => {
      map.setFog({
        color: "rgb(15, 23, 42)",
        "high-color": "rgb(2, 6, 23)",
        "horizon-blend": 0.04,
        "space-color": "rgb(2, 6, 23)",
        "star-intensity": 0.6,
      });
      ensureAircraftLayers(map);
      setReady(true);
      setBbox(boundsToBBox(map.getBounds()!));
    });

    let bboxTimer: ReturnType<typeof setTimeout> | null = null;
    const onMoveEnd = () => {
      if (bboxTimer) clearTimeout(bboxTimer);
      bboxTimer = setTimeout(() => {
        const b = map.getBounds();
        if (b) setBbox(boundsToBBox(b));
      }, 350);
    };
    map.on("moveend", onMoveEnd);

    const handleClick = (e: mapboxgl.MapMouseEvent) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [AIRCRAFT_DOT_LAYER],
      });
      const id = features[0]?.properties?.icao24 as string | undefined;
      if (id) fireClick(id);
    };
    map.on("click", AIRCRAFT_DOT_LAYER, handleClick);

    const setPointer = () => (map.getCanvas().style.cursor = "pointer");
    const resetPointer = () => (map.getCanvas().style.cursor = "");
    map.on("mouseenter", AIRCRAFT_DOT_LAYER, setPointer);
    map.on("mouseleave", AIRCRAFT_DOT_LAYER, resetPointer);

    const stopPulse = startAircraftPulse(map);

    return () => {
      stopPulse();
      if (bboxTimer) clearTimeout(bboxTimer);
      map.off("moveend", onMoveEnd);
      map.off("click", AIRCRAFT_DOT_LAYER, handleClick);
      map.off("mouseenter", AIRCRAFT_DOT_LAYER, setPointer);
      map.off("mouseleave", AIRCRAFT_DOT_LAYER, resetPointer);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  const flyTo = useCallback((name: CameraPosition) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo({ ...CAMERA_POSITIONS[name], duration: 2200, essential: true });
  }, []);

  return { containerRef, map: mapRef, ready, bbox, flyTo };
}

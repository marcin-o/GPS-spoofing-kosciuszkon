import type { Map as MapboxMap, GeoJSONSource } from "mapbox-gl";
import type { Feature, FeatureCollection, Point } from "geojson";
import type { Flight } from "@/lib/api/types";

export const AIRCRAFT_SOURCE_ID = "aircraft-source";
export const AIRCRAFT_DOT_LAYER = "aircraft-dot";
export const AIRCRAFT_PULSE_LAYER = "aircraft-pulse";

type AircraftFeatureProps = {
  icao24: string;
  callsign: string;
  score: number;
  level: Flight["alert_level"];
  heading: number;
};

export function flightsToFeatureCollection(
  flights: Flight[],
): FeatureCollection<Point, AircraftFeatureProps> {
  const features: Feature<Point, AircraftFeatureProps>[] = flights.map((f) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [f.lon, f.lat] },
    properties: {
      icao24: f.icao24,
      callsign: f.callsign ?? f.icao24,
      score: f.spoofing_score,
      level: f.alert_level,
      heading: f.heading ?? 0,
    },
  }));
  return { type: "FeatureCollection", features };
}

const COLOR_OK = "#10b981";
const COLOR_WARN = "#f59e0b";
const COLOR_CRIT = "#ef4444";

export function ensureAircraftLayers(map: MapboxMap) {
  if (!map.getSource(AIRCRAFT_SOURCE_ID)) {
    map.addSource(AIRCRAFT_SOURCE_ID, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      clusterMaxZoom: 6,
      clusterRadius: 30,
    });
  }

  if (!map.getLayer("aircraft-clusters")) {
    map.addLayer({
      id: "aircraft-clusters",
      type: "circle",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#1e293b",
        "circle-stroke-color": "#475569",
        "circle-stroke-width": 1,
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["get", "point_count"],
          2,
          12,
          50,
          22,
          200,
          32,
        ],
      },
    });

    map.addLayer({
      id: "aircraft-cluster-count",
      type: "symbol",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-font": ["DIN Pro Medium", "Arial Unicode MS Regular"],
        "text-size": 11,
      },
      paint: { "text-color": "#cbd5e1" },
    });
  }

  if (!map.getLayer(AIRCRAFT_PULSE_LAYER)) {
    map.addLayer({
      id: AIRCRAFT_PULSE_LAYER,
      type: "circle",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["all", ["!", ["has", "point_count"]], ["==", ["get", "level"], "critical"]],
      paint: {
        "circle-radius": 18,
        "circle-color": COLOR_CRIT,
        "circle-opacity": 0.5,
        "circle-blur": 0.5,
      },
    });
  }

  if (!map.getLayer(AIRCRAFT_DOT_LAYER)) {
    map.addLayer({
      id: AIRCRAFT_DOT_LAYER,
      type: "circle",
      source: AIRCRAFT_SOURCE_ID,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          1,
          5,
          5,
          8,
          10,
          11,
        ],
        "circle-color": [
          "match",
          ["get", "level"],
          "ok",
          COLOR_OK,
          "warn",
          COLOR_WARN,
          "critical",
          COLOR_CRIT,
          COLOR_OK,
        ],
        "circle-stroke-color": "#0f172a",
        "circle-stroke-width": 2,
        "circle-opacity": 0.95,
      },
    });
  }
}

export function setAircraftData(map: MapboxMap, flights: Flight[]) {
  const src = map.getSource(AIRCRAFT_SOURCE_ID) as GeoJSONSource | undefined;
  if (!src) return;
  src.setData(flightsToFeatureCollection(flights));
}

export function startAircraftPulse(map: MapboxMap): () => void {
  let raf = 0;
  let lastApplied = -1;
  const PERIOD_MS = 1400;

  const tick = (ts: number) => {
    if (!map.getLayer(AIRCRAFT_PULSE_LAYER)) {
      raf = requestAnimationFrame(tick);
      return;
    }
    const phase = (ts % PERIOD_MS) / PERIOD_MS;
    if (Math.abs(phase - lastApplied) > 0.02) {
      lastApplied = phase;
      const radius = 14 + phase * 24;
      const opacity = 0.7 * (1 - phase);
      map.setPaintProperty(AIRCRAFT_PULSE_LAYER, "circle-radius", radius);
      map.setPaintProperty(AIRCRAFT_PULSE_LAYER, "circle-opacity", opacity);
    }
    raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}

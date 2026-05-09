import { http, HttpResponse } from "msw";
import type {
  AlertEvent,
  ExplainResponse,
  Flight,
  OnboardScoreRequest,
  OnboardScoreResponse,
} from "@/lib/api/types";
import {
  mockFlights,
  mockIncidents,
  mockReplays,
  mockShips,
} from "./fixtures";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "http://localhost:8000";

const explainCache: Record<string, ExplainResponse> = {};

function jitter(flights: Flight[]): Flight[] {
  return flights.map((f) => ({
    ...f,
    lat: f.lat + (Math.random() - 0.5) * 0.05,
    lon: f.lon + (Math.random() - 0.5) * 0.05,
    spoofing_score: Math.min(
      1,
      Math.max(0, f.spoofing_score + (Math.random() - 0.5) * 0.04),
    ),
  }));
}

export const handlers = [
  http.get(`${API_BASE}/api/flights/live`, () =>
    HttpResponse.json(jitter(mockFlights)),
  ),

  http.get(`${API_BASE}/api/ships/live`, () => HttpResponse.json(mockShips)),

  http.get(`${API_BASE}/api/incidents`, () => HttpResponse.json(mockIncidents)),

  http.get(`${API_BASE}/api/incidents/:id/replay`, ({ params }) => {
    const id = String(params.id);
    const replay = mockReplays[id];
    if (!replay) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(replay);
  }),

  http.post(`${API_BASE}/api/score/onboard`, async ({ request }) => {
    const body = (await request.json()) as OnboardScoreRequest;
    const cn0 = body.features.cn0_ch1 ?? 45;
    const doppler = body.features.doppler_ch1 ?? 1000;
    const score = Math.min(
      1,
      Math.max(0, (50 - cn0) / 30 + Math.abs(doppler - 1500) / 4000),
    );
    const klass: OnboardScoreResponse["class"] =
      score > 0.85 ? "sophisticated" : score > 0.55 ? "meaconing" : "clean";
    const shap: OnboardScoreResponse["shap"] = [
      { feature: "cn0_ch1", value: cn0, contribution: -((50 - cn0) / 50) },
      {
        feature: "doppler_ch1",
        value: doppler,
        contribution: Math.abs(doppler - 1500) / 4000,
      },
      {
        feature: "agc_level",
        value: body.features.agc_level ?? 0.4,
        contribution: 0.12,
      },
      {
        feature: "satellite_count",
        value: body.features.satellite_count ?? 8,
        contribution: -0.08,
      },
      {
        feature: "carrier_phase_var",
        value: body.features.carrier_phase_var ?? 0.05,
        contribution: 0.06,
      },
    ];
    return HttpResponse.json({
      score: Number(score.toFixed(2)),
      class: klass,
      shap,
    } satisfies OnboardScoreResponse);
  }),

  http.get(`${API_BASE}/api/explain/:id`, ({ params }) => {
    const id = String(params.id);
    if (!explainCache[id]) {
      const target = mockFlights.find((f) => f.icao24 === id) ?? mockFlights[0];
      explainCache[id] = {
        aircraft_id: id,
        top_features: [
          { feature: "Δposition_3σ", value: 1.0, contribution: 0.42 },
          { feature: "NIC_drop", value: 1.0, contribution: 0.31 },
          { feature: "velocity_inconsistency", value: 0.7, contribution: 0.18 },
          { feature: "trajectory_smoothness", value: 0.45, contribution: 0.06 },
          { feature: "heading_chatter", value: 0.2, contribution: 0.03 },
        ],
        plain_english:
          target.alert_level === "critical"
            ? "Aircraft reported a sudden 4.2km position jump while NIC dropped from 8 to 0. Velocity vector inconsistent with heading. High likelihood of GPS spoofing."
            : "Trajectory mildly noisy but within tolerance. No corroborating signals.",
      };
    }
    return HttpResponse.json(explainCache[id]);
  }),

  http.post(`${API_BASE}/api/alerts/:id/speak`, () =>
    new HttpResponse(SILENT_MP3, {
      headers: { "Content-Type": "audio/mpeg" },
    }),
  ),
];

const SILENT_MP3 = Uint8Array.from(
  atob(
    "//uQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAACgwBVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVf////////////////////////////////////////////////////////////////8AAAA8TEFNRTMuMTAwBK8AAAAAAAAAABRAJAJAQgAAQAAAAoMHaqAaAAAAAAAA",
  ),
  (c) => c.charCodeAt(0),
);

export type MockAlertEvent = AlertEvent;

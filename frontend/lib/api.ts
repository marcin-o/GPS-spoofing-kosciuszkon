import type { HealthResponse, Incident, IncidentReplay } from "@/lib/types";
import { INCIDENTS_FALLBACK } from "@/lib/incidents-fallback";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, "") ?? "http://localhost:8000"
);

export const WS_BASE = API_BASE.replace(/^http/, "ws");

export async function getHealth(): Promise<HealthResponse | null> {
  try {
    const r = await fetch(`${API_BASE}/api/health`);
    if (!r.ok) return null;
    return (await r.json()) as HealthResponse;
  } catch {
    return null;
  }
}

export async function getIncidents(): Promise<Incident[]> {
  try {
    const r = await fetch(`${API_BASE}/api/incidents`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const live = (await r.json()) as Incident[];
    return live.map((entry) => {
      const fallback = INCIDENTS_FALLBACK.find((f) => f.id === entry.id);
      return { ...fallback, ...entry };
    });
  } catch {
    return INCIDENTS_FALLBACK;
  }
}

export async function getIncidentReplay(id: string): Promise<IncidentReplay | null> {
  try {
    const r = await fetch(`${API_BASE}/api/incidents/${encodeURIComponent(id)}/replay`);
    if (!r.ok) return null;
    return (await r.json()) as IncidentReplay;
  } catch {
    return null;
  }
}

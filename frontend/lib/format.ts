export function fmtRatio(r: number): string {
  if (!isFinite(r)) return "—";
  return `${r.toFixed(2)}×`;
}

export function fmtCoord(lat: number, lon: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lon >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(3)}° ${ns}, ${Math.abs(lon).toFixed(3)}° ${ew}`;
}

export function fmtAlt(m: number): string {
  return `${(m / 1000).toFixed(1)}k m`;
}

export function fmtVel(mps: number): string {
  return `${(mps * 1.94384).toFixed(0)} kt`;
}

export function fmtMs(ms: number): string {
  if (ms < 1) return "<1 ms";
  return `${ms.toFixed(0)} ms`;
}

export function fmtAge(now: number, ts: number): string {
  const sec = Math.max(0, (now - ts) / 1000);
  if (sec < 1) return "now";
  if (sec < 60) return `${sec.toFixed(0)}s`;
  return `${(sec / 60).toFixed(0)}m`;
}

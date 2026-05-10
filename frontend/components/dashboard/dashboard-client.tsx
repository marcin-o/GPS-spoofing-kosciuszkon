"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE, WS_BASE } from "@/lib/api";
import type { GlobeTick, HealthResponse, Mode, OnboardTick, Scenario } from "@/lib/types";
import { startGlobeMock, startOnboardMock } from "@/lib/mock-feed";
import { TopBar } from "./top-bar";
import { OnboardMonitor } from "./onboard-monitor";
import { LiveGlobe } from "./live-globe";
import { ModelFooter } from "./model-footer";
import { AlertSystem, type AlertEvent } from "./alert-system";
import type { Verdict } from "@/lib/types";
import { ReplayView } from "@/components/replay/replay-view";

const FALLBACK_SCENARIOS: Scenario[] = [
  { id: "normal_waw_gdn", name: "Lot normalny: WAW → GDN", mode: "onboard", duration_s: 20, expected_dominant_layer: null, description: "Czyste odczyty WAW→GDN." },
  { id: "texbat_spoof", name: "TEXBAT spoofing (sygnał)", mode: "onboard", duration_s: 20, expected_dominant_layer: "L1", description: "Atak L1." },
  { id: "aissou_channel_attack", name: "Atak kanałowy Aissou", mode: "onboard", duration_s: 20, expected_dominant_layer: "L2", description: "Atak L2 PRN3+PRN5." },
  { id: "baltic_teleport", name: "Bałtyk: teleport", mode: "live_globe", duration_s: 90, expected_dominant_layer: "ensemble", description: "Skok pozycji nad Bałtykiem." },
  { id: "smooth_drift_fleet", name: "Płynny drift (live)", mode: "live_globe", duration_s: 90, expected_dominant_layer: "ensemble", description: "Wolny drift wykryty przez LSTM-AE." },
];

const SESSION_ID = (() => {
  if (typeof window === "undefined") return "ssr";
  const k = "gnss-session-id";
  let v = window.sessionStorage.getItem(k);
  if (!v) {
    v = `sess-${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(k, v);
  }
  return v;
})();

export function DashboardClient() {
  const [mode, setMode] = useState<Mode>("onboard");
  const [scenario, setScenario] = useState("normal_waw_gdn");
  const [scenarios, setScenarios] = useState<Scenario[]>(FALLBACK_SCENARIOS);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [mockMode, setMockMode] = useState(false);
  const [onboardTick, setOnboardTick] = useState<OnboardTick | null>(null);
  const [globeTick, setGlobeTick] = useState<GlobeTick | null>(null);
  const [onboardHistory, setOnboardHistory] = useState<OnboardTick[]>([]);
  const [globeHistory, setGlobeHistory] = useState<GlobeTick[]>([]);
  const [injectFlash, setInjectFlash] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const mockStopRef = useRef<(() => void) | null>(null);
  const injectPendingRef = useRef(false);

  const verdictsRef = useRef<string[]>([]);

  const [alerts, setAlerts] = useState<AlertEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const lastOnboardVerdictRef = useRef<Verdict>("OK");
  const lastGlobeAcVerdictRef = useRef<Map<string, Verdict>>(new Map());

  // EWMA state for smoothing per-tick noise on the displayed ratios.
  // α=0.3 ⇒ ~3-tick lag, kills 100ms jitter without hiding inject ramps.
  const ewmaRef = useRef<{ L1: number | null; L2: number | null; lat_ms: number | null }>({
    L1: null, L2: null, lat_ms: null,
  });
  const SMOOTH_ALPHA = 0.3;

  function pushAlert(ev: AlertEvent) {
    setAlerts((cur) => [...cur, ev].slice(-32));
  }

  function ewma(prev: number | null, next: number, alpha = SMOOTH_ALPHA): number {
    if (prev === null) return next;
    return prev + alpha * (next - prev);
  }

  // Boot: probe backend health.
  useEffect(() => {
    fetch(`${API_BASE}/api/health`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((h: HealthResponse) => {
        setHealth(h);
        setMockMode(false);
      })
      .catch(() => setMockMode(true));
    fetch(`${API_BASE}/api/scenarios`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((s: Scenario[]) => setScenarios(s))
      .catch(() => setScenarios(FALLBACK_SCENARIOS));
  }, []);

  // Pin the scenario to whatever's available for the active mode.
  // In replay mode all scenarios are valid — no filtering needed.
  useEffect(() => {
    if (mode === "replay") return;
    const filtered = scenarios.filter((s) => s.mode === mode);
    if (filtered.length === 0) return;
    if (!filtered.some((s) => s.id === scenario)) {
      setScenario(filtered[0].id);
    }
  }, [mode, scenarios, scenario]);

  // Open WS on mode/scenario change. If backend offline, fall back to mock.
  // Replay mode manages its own data fetching inside ReplayView — skip WS here.
  useEffect(() => {
    // Cleanup any prior connection or mock loop.
    wsRef.current?.close();
    mockStopRef.current?.();
    wsRef.current = null;
    mockStopRef.current = null;
    setOnboardTick(null);
    setGlobeTick(null);
    setOnboardHistory([]);
    setGlobeHistory([]);
    verdictsRef.current = [];
    lastOnboardVerdictRef.current = "OK";
    lastGlobeAcVerdictRef.current = new Map();
    ewmaRef.current = { L1: null, L2: null, lat_ms: null };

    if (mode === "replay") return;

    if (mockMode) {
      const stop = mode === "onboard"
        ? startOnboardMock({
            scenario,
            inject: () => {
              if (!injectPendingRef.current) return false;
              injectPendingRef.current = false;
              return true;
            },
            onTick: (t) => receiveOnboardTick(t as OnboardTick),
          })
        : startGlobeMock({
            scenario,
            inject: () => {
              if (!injectPendingRef.current) return false;
              injectPendingRef.current = false;
              return true;
            },
            onTick: (t) => receiveGlobeTick(t as GlobeTick),
          });
      mockStopRef.current = stop;
      return () => stop();
    }

    const url = `${WS_BASE}/ws/${mode === "onboard" ? "onboard" : "globe"}?scenario=${encodeURIComponent(scenario)}`;
    let ws: WebSocket;
    let opened = false;
    let closing = false;
    try {
      ws = new WebSocket(url);
    } catch (e) {
      setMockMode(true);
      return;
    }
    wsRef.current = ws;

    ws.onopen = () => {
      opened = true;
      injectPendingRef.current = false;
    };
    ws.onerror = () => {
      // Only treat as backend-down if we never managed to open a connection
      // and we're not in the middle of a teardown.
      if (!opened && !closing) {
        console.warn("ws connection failed → switching to mock mode");
        setMockMode(true);
      }
    };
    ws.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.context === "onboard") receiveOnboardTick(data);
        else if (data.context === "live_globe") receiveGlobeTick(data);
        else if (data.error) console.warn("ws error msg:", data.error);
      } catch (e) {
        console.warn("ws parse error", e);
      }
    };

    return () => {
      closing = true;
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, scenario, mockMode]);

  function receiveOnboardTick(t: OnboardTick) {
    // Apply EWMA on ratios + latency before storing. Verdict transitions
    // remain crisp because verdict comes from the server's threshold check
    // (not the smoothed ratio); smoothing only affects displayed numbers.
    const sL1 = ewma(ewmaRef.current.L1, t.scores.L1.ratio);
    const sL2 = ewma(ewmaRef.current.L2, t.scores.L2.ratio);
    ewmaRef.current.L1 = sL1;
    ewmaRef.current.L2 = sL2;
    const smoothed: OnboardTick = {
      ...t,
      scores: {
        L1: { ...t.scores.L1, ratio: sL1 },
        L2: { ...t.scores.L2, ratio: sL2 },
      },
    };

    setOnboardTick(smoothed);
    setOnboardHistory((h) => {
      const next = [...h, smoothed];
      return next.length > 200 ? next.slice(-200) : next;
    });
    verdictsRef.current = [...verdictsRef.current, smoothed.verdict].slice(-200);
    if (t.inference_ms?.xgboost) {
      const sLat = ewma(ewmaRef.current.lat_ms, t.inference_ms.xgboost);
      ewmaRef.current.lat_ms = sLat;
      setLatency(sLat);
    }

    // Verdict transition alert (OK→WARN, OK→CRIT, WARN→CRIT only).
    const prev = lastOnboardVerdictRef.current;
    if (verdictRank(smoothed.verdict) > verdictRank(prev)) {
      pushAlert({
        id: `${smoothed.scenario_id}-${smoothed.tick}-${smoothed.verdict}`,
        ts: smoothed.t,
        verdict: smoothed.verdict,
        context: "onboard",
        callsign: smoothed.callsign,
        layer: smoothed.dominant_layer,
        ratio: smoothed.scores[smoothed.dominant_layer].ratio,
        reason: smoothed.top_reasons[0] ?? "Verdict escalation",
      });
    }
    lastOnboardVerdictRef.current = smoothed.verdict;
  }

  function receiveGlobeTick(t: GlobeTick) {
    setGlobeTick(t);
    setGlobeHistory((h) => {
      const next = [...h, t];
      return next.length > 100 ? next.slice(-100) : next;
    });
    if (t.inference_ms?.ensemble_per_100ac) {
      setLatency(t.inference_ms.ensemble_per_100ac);
    }
    const worst = t.aircraft.reduce<string>((acc, a) => {
      if (a.verdict === "CRITICAL") return "CRITICAL";
      if (a.verdict === "WARNING" && acc !== "CRITICAL") return "WARNING";
      return acc;
    }, "OK");
    verdictsRef.current = [...verdictsRef.current, worst].slice(-200);

    // Per-aircraft transition alert.
    for (const a of t.aircraft) {
      const prev = lastGlobeAcVerdictRef.current.get(a.icao24) ?? "OK";
      if (verdictRank(a.verdict) > verdictRank(prev)) {
        pushAlert({
          id: `${t.scenario_id}-${t.tick}-${a.icao24}-${a.verdict}`,
          ts: t.t,
          verdict: a.verdict,
          context: "live_globe",
          callsign: a.callsign,
          layer: a.dominant_submodel,
          ratio: a.ensemble_score.ratio,
          reason: a.top_reasons[0] ?? "Ensemble flagged",
        });
      }
      lastGlobeAcVerdictRef.current.set(a.icao24, a.verdict);
    }
  }

  function verdictRank(v: Verdict): number {
    return v === "CRITICAL" ? 2 : v === "WARNING" ? 1 : 0;
  }

  const triggerInject = useCallback(() => {
    setInjectFlash(true);
    setTimeout(() => setInjectFlash(false), 250);

    if (mockMode) {
      injectPendingRef.current = true;
      return;
    }
    fetch(`${API_BASE}/api/inject/${encodeURIComponent(scenario)}`, { method: "POST" })
      .catch((e) => console.warn("inject failed", e));
  }, [scenario, mockMode]);

  const triggerExport = useCallback(() => {
    const verdicts = verdictsRef.current.slice(-60).join(",");
    const url = `${API_BASE}/api/report/${encodeURIComponent(SESSION_ID)}?scenario=${encodeURIComponent(scenario)}&verdicts=${encodeURIComponent(verdicts)}`;
    if (mockMode) {
      // No backend — open a generated text report inline.
      const blob = new Blob(
        [`GNSS Defense Monitor — Mock Incident Report\nSession: ${SESSION_ID}\nScenario: ${scenario}\nVerdicts: ${verdicts}\n(backend offline; PDF generation unavailable in mock mode)\n`],
        { type: "text/plain" },
      );
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `incident_${SESSION_ID}.txt`;
      a.click();
      return;
    }
    window.open(url, "_blank");
  }, [scenario, mockMode]);

  const scenarioMeta = useMemo(
    () => scenarios.find((s) => s.id === scenario),
    [scenarios, scenario],
  );

  return (
    <div className="flex flex-col h-screen bg-slate-950 text-slate-100">
      <TopBar
        mode={mode}
        onModeChange={setMode}
        scenario={scenario}
        onScenarioChange={setScenario}
        scenarios={scenarios}
        inferenceMs={latency}
        onInject={triggerInject}
        onExport={triggerExport}
        mockMode={mockMode}
        injectFlash={injectFlash}
      />

      {injectFlash && (
        <div className="fixed inset-0 bg-[#EE3124]/20 pointer-events-none z-30 animate-pulse" />
      )}

      <main className="flex-1 min-h-0 flex flex-col">
        {mode === "onboard" && (
          <OnboardMonitor tick={onboardTick} history={onboardHistory} scenarioName={scenarioMeta?.name ?? scenario} />
        )}
        {mode === "live_globe" && (
          <LiveGlobe tick={globeTick} history={globeHistory} scenarioName={scenarioMeta?.name ?? scenario} />
        )}
        {mode === "replay" && (
          <ReplayView
            scenario={scenario}
            scenarioMeta={scenarioMeta ?? null}
            mockMode={mockMode}
          />
        )}
      </main>

      <ModelFooter health={health} mockMode={mockMode} />

      <AlertSystem
        events={alerts}
        soundEnabled={soundEnabled}
        onToggleSound={() => setSoundEnabled((s) => !s)}
      />
    </div>
  );
}

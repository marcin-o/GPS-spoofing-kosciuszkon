# 90-second demo script — BeDetector

Five scenarios, one mode-switch, one inject, one PDF export. Practiced timings in **bold**.

## Setup (before camera)

1. `make demo` — uvicorn on :8000 + Next dev on :3000.
2. Open http://localhost:3000 in Chromium full-screen.
3. Confirm the bottom MODELS strip lists six versions (texbat-xgb-v1 … opensky-ensemble-v1) and there's no "MOCK MODE" banner.

## Scene 1 — Czysty lot WAW → GDN (0:00–0:15)

> "BeDetector monitoruje samolot LOT283 z Warszawy do Gdańska w czasie rzeczywistym.
> Górny pasek pokazuje L1 — sygnał TEXBAT (XGBoost na 27 cechach odbiornika).
> Drugi pasek to L2 — kanały Aissou (XGBoost na 80 cechach × 8 kanałów). 
> Oba ratio poniżej 1.0× — verdict OK."

- **Stay 5 s** on the green sparklines; let alert feed scroll.

## Scene 2 — Atak TEXBAT (0:15–0:35)

- Switch scenario to **TEXBAT spoofing (sygnał)**.
- **Wait 8 s** for L1 to climb naturally past 1.0×.

> "Po 8 sekundach L1 przebija próg — wariancja C/N₀ spadła o 70%, residuum pseudorange skoczyło do 90 m.
> Verdict skacze przez WARNING do CRITICAL. L2 pozostaje czyste — atak jest sygnałowy, nie kanałowy.
> Dominant_layer w prawym dolnym statbloku potwierdza L1."

- **Click INJECT ATTACK** — czerwony błysk; ratio dobija do 1.85–2.00× w 2 s.

## Scene 3 — Atak kanałowy Aissou (0:35–0:55)

- Scenario → **Atak kanałowy Aissou**.
- **Wait 6 s**.

> "Inny atak — tym razem celowany w PRN3 i PRN5. L1 czyste (sygnał wygląda dobrze!), L2 wzrasta.
> To jest powód, dla którego mamy dwie warstwy — same odbiorniki nie wystarczą. Top reasons pokazują
> które konkretne kanały odpaliły — to nie blackbox."

## Scene 4 — Live Globe / Bałtyk teleport (0:55–1:20)

- Click **LIVE GLOBE** w nagłówku.
- Scenario → **Bałtyk: teleport**.
- **Wait 12 s** (anomaly kicks in around tick 12).

> "To jest kontekst flotowy — dane ADS-B z OpenSky w czasie rzeczywistym.
> Warstwa L3 to ensemble: dwa IsolationForesty (klasyczne i wieloskalowe) plus LSTM autoenkoder na trajektoriach.
> Decyzja przez OR-fusion: ratio = max(scores/thresholds)."

- Two markers turn red over the Baltic. Click one in the aircraft list.

> "Ensemble breakdown po prawej pokazuje który sub-model wykrył anomalię — tu LSTM-AE złapał skok pozycji 280 km."

## Scene 5 — Smooth drift + raport (1:20–1:30)

- Scenario → **Płynny drift (live)**.

> "Trudniejszy atak — wolny, ciągły drift. IsolationForesty go nie złapią, ale LSTM-AE owszem,
> bo trajektoria łamie naturalną dynamikę lotu."

- Click **EXPORT REPORT**.

> "Każda sesja generuje audytowalny PDF — wersje modeli, oś czasu verdict, latencja inferencji."

## Recovery / fallbacks

- Backend padło? Banner **MOCK MODE — backend offline** zapali się na top barze.
  Scenariusze grają z client-side mocka — wow-moment z inject nadal działa.
- WebSocket zerwany? Hook auto-reconnectuje; wystarczy wybrać scenariusz ponownie.
- Latency > 100 ms na demo laptopie? `/api/health` zwraca per-scenario latency w `inference_latency_ms`.

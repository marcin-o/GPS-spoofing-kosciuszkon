# Frontend — BeDetector

Next.js 16 (App Router) + TypeScript + Tailwind v4 + shadcn/ui + Mapbox GL JS v3.
Single-page dashboard with four routes:

| Route        | Purpose                                                              |
| ------------ | -------------------------------------------------------------------- |
| `/`          | Live Globe — 3D Mapbox globe + live aircraft + click→SHAP panel      |
| `/replay`    | Incident Replay — Flight 8243 / Hormuz / Beirut, time-slider + audio |
| `/onboard`   | On-board Detector — GNSS feature form → score + SHAP                  |
| `/analytics` | Analytics — confusion matrices, ROC overlay, SHAP, drone MP4, cards   |

## Quickstart

```bash
cp .env.example .env.local
# edit .env.local: paste your NEXT_PUBLIC_MAPBOX_TOKEN
npm install
npm run dev   # http://localhost:3000
```

Without `NEXT_PUBLIC_MAPBOX_TOKEN`, the globe renders a friendly "token missing"
card; everything else still works.

`NEXT_PUBLIC_USE_MSW=true` (default in `.env.example`) boots Mock Service Worker
in the browser so the FE works offline against fixtures while Person B's
FastAPI backend is offline. Set to anything else (or unset) to hit the real API
at `NEXT_PUBLIC_API_BASE` (default `http://localhost:8000`).

## Scripts

```bash
npm run dev          # Turbopack dev server
npm run build        # production build
npm run start        # production server
npm run lint         # eslint
./node_modules/.bin/tsc --noEmit   # typecheck
```

## Demo controls

In the Live Globe, hotkeys **1–5** flyTo the cinematic camera positions:

```
1 Globe   2 Middle East   3 Grozny   4 Hormuz   5 Beirut
```

The same keys are exposed as buttons in the bottom-left CameraDeck.

## File structure

```
app/                  Next.js App Router (4 routes + per-route error.tsx)
  layout.tsx          root layout, providers, header
  providers.tsx       'use client' — TanStack, theme, MSW init (dev only)
  page.tsx            /            Live Globe (dynamic import, ssr:false)
  replay/             /replay
  onboard/            /onboard
  analytics/          /analytics
components/
  ui/                 shadcn primitives (8 cherry-picked)
  layout/             header, tab-nav, theme-toggle
  audio-player.tsx    BIP intro + MP3 playback
  score-badge.tsx     ok/warn/critical pill
features/
  live-globe/         Mapbox globe + native circle layers + pulse + Sheet
  incident-replay/    rAF time slider + dual-line trajectory + sparkline
  onboard-detector/   feature presets + SHAP top-5 result
  analytics/          ConfusionMatrix, RocOverlay, FeatureImportance, ShapSummary,
                      TradeoffCurve, DroneVideoCard, ModelCardView, ComparisonTable
lib/
  api/types.ts        single source of truth — mirrors PRD §9
  api/client.ts, flights.ts, ships.ts, incidents.ts, onboard.ts, explain.ts,
  api/alerts.ts, metrics.ts
  mapbox.ts           token, globe init, named camera positions
  bbox.ts, utils.ts
mocks/
  handlers.ts, fixtures.ts, browser.ts   MSW handlers + 10 aircraft / 5 ships / 3 incidents
public/
  data/metrics.json   placeholder; Person C overwrites with real evaluation
  data/drone-replay.mp4   Person C drops PX4 GPS-IMU divergence demo here
  docs/model_cards.md     Person C overwrites with the real model card
  mockServiceWorker.js    auto-installed by `npx msw init`
```

## API contract

`lib/api/types.ts` mirrors PRD §9. **Don't edit either side without updating
the other** — the contract is the team handshake between FE and Person B's
FastAPI. Notable shapes:

- `Flight` — what `GET /api/flights/live?bbox=...` returns per record
- `IncidentReplay` — `GET /api/incidents/{id}/replay` with `frames[]`
- `OnboardScoreResponse` — `POST /api/score/onboard`
- `ExplainResponse` — `GET /api/explain/{aircraft_id}`
- `AlertEvent` — what flows over the optional `WS /ws/alerts`

## What's deliberately not here yet

- **WebSocket `/ws/alerts`** — wired only when Person B ships `NEXT_PUBLIC_WS_URL`.
  Polling is the default; the FE works either way.
- **Real Mapbox token** — keep out of git. URL-restrict the token at
  account.mapbox.com to `localhost:3000` and your deploy domain.
- **Vercel deploy** — optional backup demo URL; do this only after Hour 16 GO.

## Known good versions

```
next 16.2.6           react 19.2.4
tailwindcss 4         mapbox-gl 3.23
@tanstack/react-query 5.100   recharts 3.8
msw 2.14              next-themes 0.4
```

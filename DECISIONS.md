# DECISIONS

Running log of non-obvious choices made while building the GNSS Defense Monitor. The "why" matters more than the "what".

## D1 — Reuse Next.js scaffold instead of creating a Vite app
Spec says React + Vite. Existing repo has Next.js 16 + Tailwind v4 + shadcn primitives + react-query + recharts already wired. Spec also says "if 80% is done, REUSE it". A wholesale rewrite costs us hours we don't have. Decision: keep Next.js, add the missing pieces.

## D2 — Synthetic ML stand-ins
There are no model artifacts in the repo (`models/` is empty, no `ml/` package existed, `xgb.pkl` was a forward reference to "Person C ships these"). The spec assumes real TEXBAT / Aissou / OpenSky models and lists their F1 numbers. We don't have access to those datasets in this environment. `ml/train_synthetic.py` trains tiny XGBoost binary classifiers + IsolationForests + a 1-layer LSTM-AE on procedurally-generated data with a fixed seed (1337). Models are real (real joblib + torch state-dicts), pipeline is real, but the F1 numbers reported in `MODEL_VERSIONS` are the spec's claimed numbers, not measured. Documented in STATUS.md.

## D3 — Switched from Mapbox to Leaflet
The Next.js scaffold imports `mapbox-gl` everywhere but `NEXT_PUBLIC_MAPBOX_TOKEN` is empty in `.env.example`. Demo machines won't have a token. Leaflet uses OpenStreetMap tiles and works offline-ish (cached tiles). For the LIVE GLOBE mode we need a working map without an API key. Switching.

## D4 — Frontend `lib/` directory was missing → built fresh
The previous Claude scaffold left imports for `@/lib/utils`, `@/lib/api/types`, `@/lib/mapbox`, etc., but never created the files. The frontend currently won't compile. Rather than reverse-engineer the old contract, we wipe the broken old pages (`replay`, `analytics`, `onboard`) and rebuild `app/page.tsx` to host the GNSS Defense Monitor inline.

## D5 — Design fetch returned 404
`https://api.anthropic.com/v1/design/h/JYtBQq9y0Fz6q4V_fLNxGQ` → 404. We fall back to the explicit visual rules in the spec (slate-950 base, Honeywell `#EE3124`, JetBrains Mono numerics, threshold-ratio score bar with 1.0 / 1.5 markers).

## D6 — WebSocket + JSON, not Socket.IO
Spec says WS, not Socket.IO. The Next.js scaffold has `socket.io-client` installed but we'll use the native browser `WebSocket` API to keep the contract clean and FastAPI-compatible.

## D7 — Mode switcher implemented as state, not routing
The spec says mode switching shouldn't reload the page. We hold mode in React state on the same `/` route, swap the rendered subtree, and open a different WebSocket on switch.

## D8 — Mock fallback in frontend
If `/api/health` fails on initial load, the dashboard switches to a client-side mock generator that produces plausible ticks per scenario, and shows "MOCK MODE — backend offline" banner. This is the demo safety net per the spec.

## D9 — Existing legacy backend routes left in place
Existing `/api/score/onboard`, `/api/flights/live`, etc. are kept (they're harmless and the smoke tests rely on them). The new GNSS Defense Monitor routes live alongside under `/api/scenarios`, `/api/inject/*`, `/api/report/*`, plus the `/ws/onboard` and `/ws/globe` WebSocket endpoints.

## D10 — Replay engine ticks at 100ms (onboard) / 1500ms (globe)
Spec calls for these intervals (10× wall-clock). Each scenario CSV holds pre-computed feature rows; the engine indexes into them by tick number, modulo the file length, so scenarios loop indefinitely.

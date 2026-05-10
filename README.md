# BeDetector — by BeAuth

Real-time GPS spoofing detection dashboard. Two operational modes
(single-aircraft + fleet-wide), six ML model versions, five demo
scenarios, sub-5 ms inference per scoring call.

## Quick start

```bash
make install   # creates backend venv + installs frontend deps
make ml-train  # train synthetic stand-in models into models/  (one-shot, ~5s)
make demo      # uvicorn (:8000) + next dev (:3000) in parallel
```

Open <http://localhost:3000>. Backend OpenAPI at <http://localhost:8000/docs>.

If you only want to verify the ML side: `make ml-smoke`.

## Architecture

```
┌─────────────────────────────────────────────────┐
│  Browser (Next.js 16 + Tailwind + Leaflet)      │
│   - mode switcher: ONBOARD ↔ LIVE GLOBE         │
│   - score bars, alert feed, aircraft list       │
│   - mock fallback if backend offline            │
└────────────────┬────────────────────────────────┘
   WS /ws/onboard|globe?scenario=...     HTTP /api/*
                 ↓                            ↓
┌─────────────────────────────────────────────────┐
│  FastAPI (uvicorn :8000)                        │
│   - replay engine streams scenario CSVs         │
│   - alert mapper: ratio → verdict, reasons      │
│   - inject mechanism, PDF report (reportlab)    │
└────────────────┬────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────┐
│  ml.inference.score(scenario, payload)          │
│   - texbat            → texbat-xgb-v1     27d   │
│   - aissou            → aissou-xgb-bin-v1 80d   │
│   - opensky_ensemble  → OR-fusion(IF×2 + LSTM)  │
└─────────────────────────────────────────────────┘
```

## Files of interest

| Path                                   | What                                                |
| -------------------------------------- | --------------------------------------------------- |
| `ml/inference.py`                      | `score()` + smoke-test CLI                          |
| `ml/train_synthetic.py`                | Trains the synthetic stand-in models                |
| `ml/schemas.py`                        | Feature lists per scenario                          |
| `models/`                              | joblib + torch artifacts (created by `make ml-train`) |
| `scripts/generate_scenarios.py`        | Builds the 5 scenario CSVs                          |
| `backend/app/scenarios/*.csv`          | Pre-computed feature rows per tick                  |
| `backend/app/services/replay_engine.py`| Tick → row resolution + inject flag                 |
| `backend/app/services/ml_service.py`   | Wrapper around `ml.inference.score()`               |
| `backend/app/services/alert_mapper.py` | ratio → verdict + Polish reasons                    |
| `backend/app/routers/onboard_ws.py`    | `/ws/onboard`                                       |
| `backend/app/routers/globe_ws.py`      | `/ws/globe`                                         |
| `backend/app/routers/scenarios.py`     | `/api/scenarios` + `/api/inject/*`                  |
| `backend/app/routers/report.py`        | `/api/report/{session_id}` PDF                      |
| `backend/app/routers/explain.py`       | `/api/explain/{tick_id}` honest PENDING stub        |
| `frontend/components/dashboard/*`      | All UI components                                   |
| `frontend/lib/*`                       | `api`, `verdict`, `format`, `mock-feed`             |
| `e2e/screenshots.mjs`                  | Playwright sweep across all 5 scenarios             |

## Demo scenarios

1. **Lot normalny: WAW → GDN** — clean baseline.
2. **TEXBAT spoofing (sygnał)** — L1 (signal layer) attack.
3. **Atak kanałowy Aissou** — L2 (channel layer) attack on PRN3 + PRN5.
4. **Bałtyk: teleport** — fleet-wide; 2 aircraft jump ~280 km.
5. **Płynny drift (live)** — slow continuous drift (caught by LSTM-AE).

Demo script: see [DEMO.md](./DEMO.md).
Status & known limitations: see [STATUS.md](./STATUS.md).
Decision log: see [DECISIONS.md](./DECISIONS.md).
Repo recon: see [RECON.md](./RECON.md).

## Tests

```bash
make test            # 16 pytest backend tests
make ml-smoke        # ml.inference --all
cd frontend && npm run build   # type-check + production build
```

End-to-end Playwright run:
```bash
cd e2e && node screenshots.mjs   # captures e2e_screenshots/*.png
```

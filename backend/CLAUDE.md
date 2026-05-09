# Backend — agent guide

FastAPI service for the **GPS Spoofing Sentinel** hackathon project
(PRD: `../GPS_Spoofing_Sentinel_PRD_v2.md`). The frontend prototype
(Next.js 16 in `../frontend`) is already built and currently fed by
Mock Service Worker. The backend's job is to replace those mocks with
real endpoints that match the FE contract **byte-for-byte**.

## The contract is the FE mocks — not this README

The single source of truth for every endpoint shape is:

- `../frontend/mocks/handlers.ts` — every URL + response shape
- `../frontend/mocks/fixtures.ts` — concrete examples (copy field names)

If those files say `spoofing_score`, you emit `spoofing_score` —
not `risk_score`, not `score`, not camelCase. The FE swaps from MSW to
real backend by flipping `NEXT_PUBLIC_USE_MSW=false` in
`../frontend/.env.local`; the moment a field name drifts, the FE
breaks silently.

**Never modify FE files to "fix" a contract mismatch.** Fix the backend.

## Endpoint inventory (target state)

| Method | Path                            | Owner       | Notes                              |
| ------ | ------------------------------- | ----------- | ---------------------------------- |
| GET    | `/api/health`                   | on-board    | add `model_loaded: bool`           |
| GET    | `/api/flights/live?bbox=`       | network     | OpenSky → cache 15s → fallback     |
| GET    | `/api/ships/live?bbox=`         | network     | AISStream → fixture replay         |
| GET    | `/api/incidents`                | network     | 3 historical (flight-8243 etc.)    |
| GET    | `/api/incidents/{id}/replay`    | network     | frames[] real vs reported          |
| GET    | `/api/explain/{aircraft_id}`    | network     | SHAP top-5 + plain_english         |
| POST   | `/api/score/onboard`            | on-board    | xgb.pkl + SHAP, heuristic fallback |
| POST   | `/api/alerts/{id}/speak`        | on-board    | piper-tts → backup MP3             |
| WS     | `/ws/alerts`                    | network     | STRETCH; FE polls otherwise        |

The current `app/routers/{detection,demo,incidents}.py` stubs use
**wrong paths** (`/api/detection/trajectory`, `/api/demo/alerts`,
`/api/incidents/{id}/trajectory`). They are placeholders — replace
them with the routes above. Don't keep them around for "compatibility".

## Ownership split (two parallel agents)

To avoid conflicts when working in parallel:

- **Network agent** owns: `flights`, `ships`, `incidents`, `explain`,
  `alerts` (WS). Files under those names in `app/routers/` and
  `app/schemas/`.
- **On-board agent** owns: `health`, `score/onboard`, `alerts/{id}/speak`,
  `app/ml/loader.py`, `Makefile`, pytest smoke suite.

Both agents add rows to `requirements.txt` and `.env.example` — append,
don't rewrite. Both wire their routers into `app/main.py` — add new
`include_router` lines, don't delete the other agent's.

## Conventions

- **Pydantic v2** — `BaseModel`, `model_config`, `Field(...)`. Don't
  import from `pydantic.v1`.
- **Field names match `fixtures.ts` exactly**: `spoofing_score`,
  `alert_level`, `alt_m`, `vel_kt`, `lat_real`, `lon_reported`. No
  renaming "for clarity".
- **`alert_level` thresholds**: `>= 0.7` critical, `>= 0.4` warn, else
  ok. Same rule on FE (`fixtures.ts` `levelFor`). Don't drift.
- **CORS** is already wired in `app/main.py` from `FRONTEND_ORIGIN`.
  Don't widen to `*` — the FE runs on `localhost:3000`.
- **Pydantic settings** live in `app/config.py`. Add new env vars there,
  not via `os.getenv` scattered around.
- **Logging**: `logging.getLogger(__name__)`. When falling back to
  heuristics or backup MP3s, log a WARNING — Person C/D need to see it.

## ML model loading (gotcha)

Person C produces `.pkl` files into `../ml/models/` (xgb.pkl, rf.pkl,
logreg.pkl, isoforest.pkl) **during the hackathon**. The backend MUST
NOT crash at startup if those files are missing — load lazily on first
request, fall back to the heuristic that mirrors the FE mock
(see `frontend/mocks/handlers.ts` `POST /api/score/onboard` for the
formula). The fallback is what lets integration testing happen before
the ML notebook finishes.

Loader lives at `app/ml/loader.py`; both agents import from there.

## External APIs (gotcha)

- **OpenSky Network** uses OAuth2 client_credentials, not the old
  basic-auth API. Token endpoint is documented; cache the token in
  memory until expiry. Rate limit: cache live responses for 15s.
- **AISStream** is WebSocket-only — wrap it in a small async pump that
  buffers latest position per MMSI; the HTTP route reads the buffer.
- If either credential is absent, **fall back to fixtures** (seeded
  from `frontend/mocks/fixtures.ts`). Demo must work offline.

## Voice backup MP3s (do not skip)

`/api/alerts/{id}/speak` must serve audio for at least the three
incident IDs (`flight-8243`, `hormuz-2025`, `beirut-2024`) even if
piper-tts is broken on the demo laptop. Pre-record the MP3s once,
commit them to `app/data/voice_backup/{id}.mp3` (~50KB each). This
is the demo safety net per PRD §11 / §14.

## Reproducibility (CRITERION 5.4 — counts for grading)

- `requirements.txt` must be **pinned** (`fastapi==0.115.x`, not
  `fastapi`). Floating versions break demo machines.
- `Makefile` lives at the repo root (`../Makefile`), not here.
  Targets: `install`, `dev`, `demo`, `train`, `test`.
- `README.md` Quickstart must work from a fresh clone — test it on
  a clean venv before claiming done.
- Don't skip `pytest`. A 200-OK smoke test per route catches contract
  drift before the FE does.

## What NOT to do

- Don't add a database. JSON files in `app/data/` are fine for the hackathon.
- Don't add auth, Docker, or Kubernetes. Demo runs on `localhost`.
- Don't write code comments explaining what the code does. Only
  comment WHY when it's non-obvious (e.g. "OpenSky returns null
  altitude during taxi — coerce to 0").
- Don't refactor the stub routers — delete and replace.
- Don't widen CORS or disable hooks to make a problem go away. Fix
  the underlying issue.

# GPS Spoofing Sentinel — Backend

FastAPI service for the GPS Spoofing Sentinel hackathon project
(PRD: `../GPS_Spoofing_Sentinel_PRD_v2.md`). Replaces the Mock Service
Worker that currently feeds the Next.js frontend in `../frontend`.

The single source of truth for every endpoint shape is
`../frontend/mocks/handlers.ts` and `../frontend/mocks/fixtures.ts`.

## Quickstart (clean clone → demo)

From the repository root:

```bash
make install     # creates backend/.venv, installs pip deps, installs frontend npm deps
make demo        # starts uvicorn (port 8000) AND next dev (port 3000) with NEXT_PUBLIC_USE_MSW=false
```

Then open http://localhost:3000.

`make dev` does the same as `make demo` but keeps the frontend on the
mock-service-worker (useful when the backend isn't running yet).

## Running the backend alone

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env        # edit if you have OpenSky / AIS keys
uvicorn app.main:app --reload --port 8000
```

Swagger UI: http://localhost:8000/docs

## Endpoint inventory

| Method | Path                         | Owner       | Notes                              |
| ------ | ---------------------------- | ----------- | ---------------------------------- |
| GET    | `/api/health`                | on-board    | includes `model_loaded: bool`      |
| GET    | `/api/flights/live?bbox=`    | network     | OpenSky → cache 15s → fallback     |
| GET    | `/api/ships/live?bbox=`      | network     | AISStream → fixture replay         |
| GET    | `/api/incidents`             | network     | 3 historical case studies          |
| GET    | `/api/incidents/{id}/replay` | network     | frames[] real vs reported          |
| GET    | `/api/explain/{aircraft_id}` | network     | SHAP top-5 + plain_english         |
| POST   | `/api/score/onboard`         | on-board    | xgb.pkl + SHAP, heuristic fallback |
| POST   | `/api/alerts/{id}/speak`     | on-board    | piper-tts → backup MP3             |

## ML model loading

`app/ml/loader.py` lazy-loads `.pkl` files from `MODEL_DIR` (default
`../ml/models`). Person C ships these during the hackathon:

- `xgb.pkl` — multi-class on-board GNSS-feature classifier
- `isoforest.pkl` — anomaly score for the network detector

The backend MUST NOT crash if the files are absent. When `xgb.pkl` is
missing, `/api/score/onboard` falls back to the same heuristic the FE
mock uses (`(50 - cn0_ch1) / 30 + |doppler_ch1 - 1500| / 4000`, clipped
to [0, 1]) and emits a synthetic SHAP-shaped explanation. A WARNING is
logged once on the first request so the team can see it.

## Voice alerts

`POST /api/alerts/{id}/speak` returns `audio/mpeg`. It tries piper-tts
(offline neural TTS, requires `piper` and `ffmpeg` on PATH) and falls
back to a pre-recorded MP3 in `app/data/voice_backup/{id}.mp3`. Three
backups ship in the repo: `flight-8243`, `hormuz-2025`, `beirut-2024`.

To regenerate the backups with real voice (once piper is installed):

```bash
make voice
```

The shipped backups are silent placeholders — they keep the audio
pipeline working end-to-end but do not actually speak. The PRD §11/§14
demo plan calls out replacing them with real recordings before the demo.

## Tests

```bash
make test
# or directly:
cd backend && pytest tests -q
```

Smoke tests assert each endpoint returns 200 with the expected keys —
catches FE/BE contract drift before the frontend does.

## Configuration

Env vars (see `.env.example`):

| Var                        | Purpose                                     | Default                                  |
| -------------------------- | ------------------------------------------- | ---------------------------------------- |
| `APP_ENV`                  | App environment label                       | `development`                            |
| `FRONTEND_ORIGIN`          | CORS allowlist (single origin)              | `http://localhost:3000`                  |
| `OPENSKY_CLIENT_ID`        | OpenSky OAuth2 client_id                    | empty (falls back to fixtures)           |
| `OPENSKY_CLIENT_SECRET`    | OpenSky OAuth2 client_secret                | empty                                    |
| `AISSTREAM_API_KEY`        | AISStream WebSocket key                     | empty (falls back to fixtures)           |
| `MODEL_DIR`                | Where to find Person C's .pkl files         | `../ml/models`                           |
| `TTS_ENABLED`              | Run piper-tts; if false always serve backup | `true`                                   |

## Layout

```
backend/
├── app/
│   ├── main.py              # FastAPI app + CORS + router wiring
│   ├── config.py            # pydantic-settings
│   ├── ml/loader.py         # lazy .pkl loading + onboard inference
│   ├── routers/
│   │   ├── health.py        # GET /api/health
│   │   ├── score.py         # POST /api/score/onboard          (on-board)
│   │   ├── alerts_speak.py  # POST /api/alerts/{id}/speak      (on-board)
│   │   ├── flights.py       # GET  /api/flights/live           (network)
│   │   ├── ships.py         # GET  /api/ships/live             (network)
│   │   ├── incidents.py     # GET  /api/incidents (+ /replay)  (network)
│   │   └── explain.py       # GET  /api/explain/{id}           (network)
│   ├── schemas/             # Pydantic v2 models — match fixtures.ts
│   ├── services/            # OpenSky / AISStream pumps
│   └── data/
│       ├── voice_backup/    # demo safety net MP3s
│       └── *.json           # seed fixtures
├── scripts/generate_voice_backup.py
├── tests/                   # pytest smoke suite
├── requirements.txt         # pinned versions
└── .env.example
```

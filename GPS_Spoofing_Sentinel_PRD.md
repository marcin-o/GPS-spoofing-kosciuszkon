# GPS Spoofing Sentinel — PRD

**Hackathon:** Honeywell Kościuszkon 2026
**Zespół:** 4 osoby
**Czas:** 24 godziny
**Theme:** GPS Spoofing Detection (Theme 2)

---

## 1. Vision

GPS spoofing eksplodował w 2024-2026: 1500+ samolotów dziennie, 1100+ statków w Hormuz w 24h, Flight 8243 (38 ofiar). Hardware'owe rozwiązania (CRPA, hybrid INS) wdrażają się latami. Budujemy **software'ową warstwę AI**, która wykrywa spoofing w czasie rzeczywistym, działa na commodity hardware, jest domain-agnostic (lotnictwo + morska + drony), i tłumaczy każdą decyzję.

**One-liner pitch:**
> "Universal AI defense layer for civilian GPS — flags attacks across aviation, maritime, and UAVs in real time, explains every alert, deployable in weeks not years."

---

## 2. Co budujemy (MVP definition)

Single-page web app z 4 zakładkami:

1. **🌍 Live Globe** — 3D mapa Ziemi (Mapbox globe), real-time samoloty z OpenSky + statki z AISStream, czerwone podświetlenie podejrzanych jednostek, klikalne explanation panel
2. **✈️ Incident Replay** — odtworzenie 3 znanych ataków (Flight 8243, Hormuz, Bejrut) z kontrolą czasu, side-by-side trajektoria fake vs. real
3. **🚁 On-board Detector** — drone/UAV demo, model XGBoost trenowany na surowych GNSS features (Aissou dataset), SHAP explanation
4. **📊 Analytics** — confusion matrix, ROC curve, per-class metrics, feature importance, "model card" dla obu modeli

Plus stretch: voice cockpit alerts (LLM + TTS) gdy spoofing confidence > 0.85.

---

## 3. Success Metrics

**Must-hit (DoD dla MVP):**
- [ ] Live globe pokazuje minimum 30 samolotów + 10 statków z prawdziwych źródeł
- [ ] Minimum 1 historical incident odtwarza się płynnie z ML scoringiem frame-by-frame
- [ ] Trajectory model (Isolation Forest) raportuje precision ≥ 0.85, recall ≥ 0.80 na test set
- [ ] On-board model (XGBoost na Aissou) raportuje F1 ≥ 0.95
- [ ] SHAP explanation generuje się dla każdego alertu w < 2s
- [ ] Demo runs end-to-end bez crasha 3 razy z rzędu

**Nice-to-have:**
- [ ] Voice alert LLM+TTS dla minimum 1 incydentu
- [ ] WebSocket push alerts (nie polling)
- [ ] Maritime "ship on land" detection działa

**Stretch:**
- [ ] 3D trajectory ribbons (fake vs. real ribbon ekstruzja)
- [ ] Cinematic camera flyTo na incident
- [ ] Live drone simulation (PX4/jMAVSim)

---

## 4. Scope

| Status | Co | Po co |
|---|---|---|
| ✅ IN | Live aviation (OpenSky) + map | Główny demo wow |
| ✅ IN | Trajectory anomaly model (Isolation Forest) | "Network-side" detector |
| ✅ IN | On-board model (XGBoost na Aissou) | "Receiver-side" detector |
| ✅ IN | SHAP explanations | Explainable AI w pitchu |
| ✅ IN | 3 historical incidents replay | Pitch storytelling |
| 🟡 NICE | Maritime AIS tab | Multi-domain narrative |
| 🟡 NICE | Voice LLM cockpit alerts | Demo wow factor |
| 🟡 NICE | Drone tab (PX4 log replay) | Pełne multi-domain |
| 🔵 STRETCH | 3D ribbons, blast domes | Wizualna kosmetyka |
| 🔵 STRETCH | Cinematic camera animations | Pitch theatrics |
| ❌ OUT | Live HackRF spoofing transmission | Nielegalne |
| ❌ OUT | TEXBAT/OAKBAT raw I/Q processing | Za krótki czas |
| ❌ OUT | Live PX4 SITL drone | Za duże ryzyko |
| ❌ OUT | Mobile app | Poza scope |
| ❌ OUT | User auth, multi-tenancy | Demo nie potrzebuje |

---

## 5. Architektura

```
┌────────────────────────────────────────────────────┐
│  React + Vite + TypeScript          (port 5173)    │
│  ├─ Mapbox GL JS (3D globe)                        │
│  ├─ shadcn/ui + Tailwind                           │
│  ├─ TanStack Query (polling co 15s)                │
│  ├─ Recharts (metrics, SHAP)                       │
│  └─ HTML5 Audio (voice alerts)                     │
└──────────────────┬─────────────────────────────────┘
                   │ REST + WebSocket
┌──────────────────▼─────────────────────────────────┐
│  FastAPI + uvicorn                  (port 8000)    │
│                                                     │
│  /api/flights/live          ← OpenSky + scoring    │
│  /api/ships/live            ← AISStream            │
│  /api/incidents             ← replay 8243/Hormuz   │
│  /api/score/onboard         ← Aissou-style input   │
│  /api/explain/{id}          ← SHAP                 │
│  /api/alerts/{id}/speak     ← LLM + TTS            │
│  /ws/alerts                 ← push                 │
├────────────────────────────────────────────────────┤
│  ML Layer                                           │
│  ├─ trajectory_model.pkl  (IsolationForest, ADS-B) │
│  ├─ receiver_model.pkl    (XGBoost, Aissou)        │
│  └─ shap_explainers                                │
├────────────────────────────────────────────────────┤
│  Data Sources                                       │
│  ├─ OpenSky Network (OAuth2)                       │
│  ├─ AISStream.io (WebSocket, free)                 │
│  ├─ Aissou Mendeley CSV (lokalny)                  │
│  └─ Curated incident traces (lokalne JSON)         │
├────────────────────────────────────────────────────┤
│  AI Services                                        │
│  ├─ Ollama + Llama 3.1 8B (lokalnie)              │
│  └─ piper-tts (lokalnie)                           │
└────────────────────────────────────────────────────┘
```

---

## 6. Tech Stack (decyzje zamknięte)

**Frontend:**
- React 18 + Vite + TypeScript
- Mapbox GL JS v3 (globe projection mode, free tier 50k loads/mc)
- Tailwind CSS + shadcn/ui
- TanStack Query (data fetching, cache, retries)
- Recharts (wykresy)
- lucide-react (ikony)

**Backend:**
- Python 3.11
- FastAPI + uvicorn
- httpx (async HTTP do OpenSky/AISStream)
- pydantic v2
- python-socketio (WebSocket)

**ML:**
- scikit-learn (Isolation Forest, preprocessing)
- xgboost (klasyfikator on-board)
- shap (explainability)
- pandas, numpy
- joblib (model serialization)

**Voice/LLM (stretch):**
- Ollama + Llama 3.1 8B Instruct (lokalnie)
- piper-tts (TTS, lokalnie, głos en_US-lessac-medium)
- fallback: Web Speech API (przeglądarkowe)

**Dev tools:**
- Git monorepo: `/frontend`, `/backend`, `/ml`, `/data`, `/docs`
- `make dev` startuje wszystko (Makefile)
- Hot reload na obu stronach
- ENV vars w `.env` (commitować `.env.example`)

---

## 7. Team & Ownership

### 👤 Osoba A — Frontend Lead ("the visualizer")

**Owns:** całość React app, Mapbox globe, wszystkie widoki UI, audio player.

**Day 1 deliverables (0-12h):**
- Vite skeleton + Tailwind + shadcn/ui setup
- Mapbox GL JS globe initialized z access tokenem
- Layout 4 tabów (Live Globe / Incident Replay / On-board / Analytics)
- Live Globe: rendering aircraft markers z mockowanych danych
- Integracja z `/api/flights/live` przez TanStack Query (polling 15s)

**Day 2 deliverables (12-24h):**
- Incident Replay z time-slider i frame-by-frame ML scoring
- SHAP panel z bar chart (top 5 features)
- Audio player UI dla voice alerts (z BIP)
- Polish: dark mode, loading states, empty states
- Stretch: 3D ribbons, blast domes, cinematic flyTo

**Stack na bieżąco:** React, Mapbox, Tailwind, Recharts, TanStack Query.

**Hard dependencies:** B musi mieć działające API endpoints do godz. 8.

---

### 👤 Osoba B — Backend & Live Data ("the plumber")

**Owns:** FastAPI server, integracje z OpenSky/AISStream, trajectory model, WebSocket alerts.

**Day 1 deliverables (0-12h):**
- FastAPI skeleton + CORS + Pydantic schemas
- OpenSky OAuth2 client (rejestracja konta, OAuth2 client_credentials flow, token refresh)
- Endpoint `/api/flights/live?bbox=...` zwraca prawdziwe state vectors
- Trajectory feature engineering: Δposition, velocity inconsistency, trajectory smoothness, NIC drop
- Isolation Forest trenowany na trajectory features (synthetic spoof injection na czystych OpenSky danych)
- Endpoint `/api/score/trajectory` zwraca spoofing score per aircraft

**Day 2 deliverables (12-24h):**
- AISStream.io WebSocket client → endpoint `/api/ships/live`
- Endpoint `/api/incidents` z trzema scenariuszami (lokalne JSON-y)
- WebSocket `/ws/alerts` push gdy nowy alert (score > threshold)
- Caching OpenSky responses (in-memory, TTL 15s) żeby nie wyczerpać rate limita
- Stretch: blocklist statków-w-doku do redukcji false positives

**Stack:** FastAPI, httpx, scikit-learn, websockets.

**Pułapki:**
- OpenSky od marca 2026 wymaga OAuth2 (basic auth wycięty) — rejestracja na opensky-network.org → Account → Create API client. Rate limit: 4000 calls/dzień authenticated. Polling co 15-20s.
- AISStream wymaga subskrypcji per bounding box (WebSocket message po połączeniu)

---

### 👤 Osoba C — ML & Insights ("the data scientist")

**Owns:** Aissou model on-board, SHAP, evaluation metrics, drone replay, model docs.

**Day 1 deliverables (0-12h):**
- Pobranie Aissou Mendeley dataset (z7dj3yyzt8 v3) i AV-GPS-Dataset
- EDA notebook: histogramy C/N0 per klasa, korelacje, PCA, label balance
- Train/test split **stratified by mission** (kluczowe — nie po wierszach!)
- XGBoost baseline + 5-fold CV + per-class metrics
- SHAP TreeExplainer wired do modelu, generowanie SHAP values dla próbek testowych
- Endpoint integration w backendzie: `/api/score/onboard` przyjmuje Aissou-style features → returns score + SHAP

**Day 2 deliverables (12-24h):**
- Drone tab: replay logu PX4 (.ulg) lub MAVLink z UAV Attack Dataset, GPS-IMU divergence chart
- Confusion matrix + ROC + precision-recall curve plots dla obu modeli
- Feature importance plot
- Model card (markdown): dataset, train/test, metrics, assumptions, limitations
- Slide deck content: wykresy, tabele wyników, tekst do slajdów technicznych

**Stack:** pandas, scikit-learn, xgboost, shap, matplotlib/plotly, joblib.

**Pułapki:**
- Aissou dataset jest w Excelu, kilka wariantów (sprawdź `Drones_Dataset_Combined.xlsx`)
- Stratify by mission — w przeciwnym razie label leakage daje 99% accuracy które nie generalizuje

---

### 👤 Osoba D — Voice/LLM & Demo Producer ("the storyteller")

**Owns:** Ollama+TTS, kuracja historical incidents, demo script, pitch deck, backup video.

**Day 1 deliverables (0-12h):**
- Research i kuracja **3 historical incidents** w formie JSON-ów:
  - Flight 8243 (25 grudnia 2024, Grozny → Aktau): ADS-B trace z OpenSky, ground truth, narrative
  - Strait of Hormuz (czerwiec 2025): AIS trace dla 5-10 statków, "ships on land" pattern
  - Beirut Airport (kwiecień 2024): "117 ships at airport" cluster
- Każdy incident jako lokalny JSON: timestamp series, lat/lon ground truth + spoofed, metadata
- Ollama install + Llama 3.1 8B pobrane (~5GB), pierwszy test prompt
- piper-tts install + test generacji audio, dobór głosu
- System prompt v1 dla cockpit alerts (temperature 0.0-0.3)

**Day 2 deliverables (12-24h):**
- Endpoint `/api/alerts/{id}/speak` → struktured JSON → LLM → TTS → MP3 stream
- Pre-generowane MP3 backup dla 3 incydentów (gdyby Ollama padł na demo)
- Demo script (timed, sekunda po sekundzie, 7 minut)
- Slide deck (15-20 slajdów): hook, problem, solution, architecture, results, limitations, future work, Q&A backup
- Backup demo video (5 min screen recording wszystkich kluczowych ścieżek)
- 2× rehearsal pitchu z zespołem

**Stack:** Ollama, piper-tts, Pydantic, ffmpeg (audio post), Keynote/Slides, OBS (video).

**Pułapki:**
- Ollama ma cold-start ~10s przy pierwszym promcie — pre-warm na starcie aplikacji
- Llama 3.1 8B na CPU ~30 tok/s, na GPU ~150 tok/s — rezerwujcie laptopa z GPU dla osoby D
- TTS ma latencję 1-3s na zdanie — UI musi pokazać "Generating..."

---

## 8. Timeline (24h checkpoints)

### ⏱ Hour 0-2: Setup & Coordination
- Wszyscy: środowisko działa lokalnie
- A: `npm create vite`, Tailwind, push do repo
- B: FastAPI hello world, OpenSky account zarejestrowany, OAuth2 token works
- C: dataset Aissou pobrany, EDA notebook open
- D: 3 incidents zidentyfikowane, Ollama instaluje się

**Sync meeting:** wszyscy w terminalu uruchamiają `make dev` i każdy widzi swoją część.

### ⏱ Hour 2-8: First Vertical Slice
**Cel:** end-to-end "flow" działa na jednym widoku, choćby z mockami.

- A: Globe renderuje, fetchuje `/api/flights/live`, pokazuje markery
- B: `/api/flights/live` zwraca prawdziwe OpenSky dane (bez ML jeszcze)
- C: XGBoost trenuje, baseline accuracy raportowany
- D: Pierwszy alert JSON → LLM → tekst (bez TTS jeszcze)

**Hard checkpoint @ Hour 8:** demo z Hour 2-8 na sync meetingu, każdy pokazuje swoją część.

### ⏱ Hour 8-16: Integration & Multi-domain
**Cel:** wszystkie 4 zakładki działają z prawdziwymi danymi.

- A: Incident Replay tab, On-board tab, Analytics tab
- B: AISStream maritime, trajectory model w produkcji, WebSocket alerts
- C: SHAP integration, drone tab, model cards
- D: TTS pipeline, backup MP3, slide deck draft

**🚨 CRITICAL CHECKPOINT @ Hour 16: GO/NO-GO decisions.**
- ✅ Aviation tab end-to-end z prawdziwymi danymi + ML scores → kontynuuj
- ❌ Aviation tab nie działa → STOP wszystkie stretche, fixujcie main flow
- Decyzja: maritime in/out
- Decyzja: drone in/out
- Decyzja: voice LLM in/out (jeśli Ollama nie odpaliła do tej pory — out, używamy backup MP3)

### ⏱ Hour 16-20: Polish & Stretch
**Cel:** to co działa wygląda profesjonalnie, stretche dorzucamy ostrożnie.

- A: dark mode, loading states, error states, stretch (3D ribbons jeśli czas)
- B: WebSocket alerts, performance tuning, cache
- C: model cards finalne, ROC plots
- D: voice alerts wired, demo script ready

### ⏱ Hour 20-22: Demo Readiness
- Full dry-run × 2 (timed)
- Backup video recording
- Submit form filled
- README.md w repo

### ⏱ Hour 22-24: Pitch Rehearsal & Submit
- Pitch × 3, każdy zna swoje 90s
- Q&A drill (top 10 najczęstszych pytań przygotowane)
- Final submit, deep breath

---

## 9. API Contract (kluczowe endpointy)

```http
GET /api/flights/live?bbox=lamin,lomin,lamax,lomax
→ 200 OK
[
  {
    "icao24": "424351",
    "callsign": "AFL2548",
    "lat": 55.7,
    "lon": 37.6,
    "alt_m": 10668,
    "vel_kt": 432,
    "heading": 92,
    "nic": 8,
    "spoofing_score": 0.12,
    "alert_level": "ok",
    "reasons": []
  }
]

GET /api/ships/live?bbox=...
→ 200 OK [{ mmsi, name, lat, lon, sog, cog, spoofing_score, ... }]

GET /api/incidents
→ 200 OK [{ id, title, date, type, region, summary }]

GET /api/incidents/{id}/replay
→ 200 OK { frames: [{ ts, lat_real, lon_real, lat_reported, lon_reported, score }] }

POST /api/score/onboard
body: { features: { cn0_ch1: 48.2, doppler_ch1: 1234.5, ... } }
→ 200 OK { score: 0.91, class: "sophisticated", shap: [...] }

GET /api/explain/{aircraft_id}
→ 200 OK { top_features: [...], plain_english: "..." }

POST /api/alerts/{id}/speak
→ 200 OK audio/mpeg (MP3 stream)

WS /ws/alerts
← { type: "alert", aircraft_id, score, region, timestamp }
```

---

## 10. Datasety i resources do pobrania NA START

**Każdy pobiera odpowiednie do swojej roli w hour 0-2:**

- **C:** Aissou UAV dataset → https://data.mendeley.com/datasets/z7dj3yyzt8/3 (Excel/CSV, ~150MB)
- **C:** AV-GPS-Dataset → https://github.com/mehrab-abrar/AV-GPS-Dataset (clone)
- **C:** UAV Attack Dataset (drone) → IEEE DataPort search "UAV Attack Dataset Pixhawk"
- **B:** OpenSky account + OAuth2 credentials → https://opensky-network.org → Account → API Client
- **B:** AISStream.io API key → https://aisstream.io (free, instant)
- **D:** Flight 8243 ADS-B trace → OpenSky historical (icao24: `60c1ec` Embraer E190, 25-12-2024 Grozny region)
- **D:** Hormuz incidents → screenshoty + analiza Windward, GPSPATRON, MarineTraffic blogs
- **D:** Bejrut "ships at airport" — Windward report April 2024
- **A:** Mapbox access token → https://account.mapbox.com (free, instant)
- **D:** Ollama → `curl -fsSL https://ollama.com/install.sh | sh; ollama pull llama3.1:8b`
- **D:** piper-tts → `pip install piper-tts; piper --model en_US-lessac-medium`

---

## 11. Risks & Mitigations

| Ryzyko | Prawdop. | Wpływ | Mitygacja |
|---|---|---|---|
| OpenSky rate limit exceeded | Średnie | Wysoki | Aggressive caching 15-20s, AISStream/ADSB.lol jako fallback |
| Aissou model overfitting (label leakage) | Wysokie | Wysoki | **Stratified split BY MISSION**, nie po wierszach. Cross-check: train accuracy ≈ test accuracy |
| Ollama nie odpala / wolny | Wysokie | Średni | Pre-recordowane MP3 jako fallback, Web Speech API plan B |
| Mapbox 3D performance laguje | Średnie | Średni | Klastrowanie powyżej 200 markerów, LOD per zoom level |
| Live demo wifi pada | Średnie | Wysoki | Backup video recording, lokalny mock dataset gdy API nie działa |
| Integracja A↔B nie zgadza się o godz. 8 | Średnie | Wysoki | Mock contract w hour 0, endpoints zwracają mocki do hour 4 |
| Sędzia pyta o prawdziwy GNSS hardware | Wysokie | Niski | Slide "future work": integracja z real GNSS (u-blox), TEXBAT, OSNMA |
| Sędzia pyta dlaczego nie kryptografia (OSNMA) | Wysokie | Niski | "Komplementarne — OSNMA dla nowych, ML dla legacy. Nasze rozwiązanie deployuje się dziś." |
| Adversarial attack na nasz model | Średnie | Niski | Limitations slide: ML można obejść, defense in depth (fusion + crypto + IRS) |

---

## 12. Demo Flow (7 minut, scripted)

```
00:00-00:45  HOOK
  D mówi: "25 grudnia 2024, Flight 8243..."
  A pokazuje globe view, kamera leci nad Grozny
  Czerwone pulsujące alerty migają

00:45-01:30  PROBLEM
  D: liczby (1500 flights/day, 1100 ships, 38 ofiar, hybrid warfare)
  A: GPSJam-style heatmapa globalna

01:30-03:00  LIVE DEMO — AVIATION
  A klika tab Live Globe
  Real OpenSky data widoczne, 30+ samolotów nad Bliskim Wschodem
  Klik na czerwony samolot → SHAP panel slide-in
  D: "model wykrył spike Δpozycji + NIC drop, 91% confidence"
  Audio: BIP + voice alert (LLM-generated lub backup MP3)

03:00-04:00  INCIDENT REPLAY — FLIGHT 8243
  A klika Incident Replay → wybiera Flight 8243
  Time slider odtwarza 12 minut lotu
  Zielona trajektoria (real) vs. czerwona (reported) rozjeżdża się
  C: "klasyczny tracker reaguje za późno, nasz w 12s"
  Confusion matrix + metrics na boku

04:00-05:00  MULTI-DOMAIN
  A: Maritime tab → Hormuz, statki "na lądzie" w lotnisku Bandar Abbas
  Ten sam model, te same feature'y, inny use case
  A: Drone tab → PX4 log, GPS-IMU divergence chart
  D: "jeden silnik, trzy domeny — bo problem jest systemowy"

05:00-06:00  TECHNICAL
  C otwiera Analytics tab
  Confusion matrices obu modeli, ROC, feature importance
  Dwie warstwy: receiver-side (XGBoost/Aissou) + network-side (IsoForest/ADS-B)
  C: "Honeywell ma już LASEREF VI i HANA — jesteśmy ich software'ową komplementą"

06:00-06:30  LIMITATIONS
  D: "ML można obejść, dane z UAS nie z lotnictwa cywilnego, false alarms..."
  Honest, ale zwięźle

06:30-07:00  CLOSE
  D: "Hardware fixes biorą lata. Software AI deployuje się jutro.
       Pokazaliśmy że ten sam model AI broni samolotu, statku i drona.
       To jest warstwa obronna dla cywilnego GPS — i dla całej współczesnej gospodarki."
  Last slide: kontakty, repo URL, QR.
```

---

## 13. Pitch Narrative (Q&A drill)

**Q: Dlaczego nie używacie OSNMA / kryptograficznych podpisów?**
A: OSNMA jest świetne, ale wymaga nowych odbiorników i nie pokrywa GPS L1 C/A. Nasze rozwiązanie działa na istniejącym hardware'ze już dziś, dla wszystkich legacy systemów. Komplementarnie.

**Q: Co jeśli atakujący trenuje GAN który omija wasz model?**
A: Każdy ML można teoretycznie omijać. Dlatego mówimy o defense in depth — ML + sensor fusion (IMU) + krypto (OSNMA) + hardware (CRPA). Plus: nasz Isolation Forest jest unsupervised, łapie nowe wzorce których nie było w trainingu.

**Q: Jaki jest false positive rate? Pilot dostanie alert co minutę?**
A: Próg ustawiamy konserwatywnie (precision > recall). FPR < 2% na test set. W produkcji można jeszcze zacieśnić, bo aviation tolerates niższy recall niż wyższy FPR.

**Q: Honeywell ma już rozwiązania spoofing — co waszego?**
A: Wasze są hardware-centric, certyfikacja latami. Nasze to software, deployable jako update. To są różne use cases — wasze dla cockpit critical, nasze dla situational awareness, ATC, fleet ops.

**Q: Skąd wiecie że Hormuz incident to spoofing a nie błąd AIS?**
A: Wzorzec: 100+ statków raportujących identyczną pozycję w środku lotniska to nie jest błąd. Oficjalne raporty Windward i U.S. Maritime Administration to potwierdzają.

**Q: Ile danych testowych?**
A: Aissou: 158k samples balanced. Trajectory model: ~10k punktów z OpenSky + synthetic spoof injection. Train/test stratified by mission żeby uniknąć leakage.

**Q: Latencja inference?**
A: XGBoost: ~3ms per sample. Isolation Forest: ~5ms. SHAP: ~50-100ms. Voice alert end-to-end: ~2-3s. W aviation acceptable.

**Q: Czy to działa offline?**
A: Tak — modele lokalne, Ollama lokalne, TTS lokalne. Tylko data sources (OpenSky/AIS) wymagają sieci. W cockpit można pre-load modele i działać autonomicznie.

---

## 14. Definition of Done — per osoba

**Osoba A (Frontend):** ✅ Cztery taby działają w przeglądarce, klikalne markery na 3D globe, SHAP panel renderuje się poprawnie, audio player gra alerts, dark mode, brak console errors.

**Osoba B (Backend):** ✅ FastAPI server odpowiada na wszystkich endpointach z kontraktu, OpenSky/AISStream zwracają prawdziwe dane, trajectory model serializowany do .pkl, WebSocket alerts działa, README opisuje setup.

**Osoba C (ML):** ✅ Oba modele wytrenowane i zserializowane, eval metrics zaraportowane (precision, recall, F1, ROC-AUC), SHAP wired do API, model cards w `/docs/model_cards.md`, drone tab pokazuje minimum 1 replay.

**Osoba D (Voice/Demo):** ✅ Trzy historical incidents jako lokalne JSON-y w `/data/incidents/`, Ollama+TTS pipeline produkuje audio dla każdego incydentu, backup MP3 nagrane, slide deck (15+ slajdów) gotowy, demo script timed, backup video nagrane.

---

## 15. Notatki końcowe

- **Communication channel:** jeden Discord/Slack/Telegram, wszyscy online cały czas
- **Sync meetings:** Hour 2, 8, 16, 20 (15 min każdy, status + blockers)
- **Pomocnik AI:** Cursor / Claude Code / Copilot dla każdego — w 24h nie kodujemy ręcznie
- **Mood:** ambitne ale realistyczne. Lepiej mieć 70% scope w 100% jakości niż 100% w 50%
- **Sleep:** zaplanujcie minimum 4h snu na osobę, najlepiej w turnusach (B+C śpi 02-06, A+D śpi 06-10), zmęczony zespół traci więcej niż zyskuje
- **Last 2h:** **WSZYSTKO STOP**, tylko pitch rehearsal i polish

**Powodzenia. Lećcie po to żeby wygrać. 🚀**

---

*Dokument: v1.0, hackathon Honeywell Kościuszkon 2026*

# GPS Spoofing Sentinel — PRD v2.0

**Hackathon:** Honeywell Kościuszkon 2026 — Theme #2 (Detection of GPS Spoofing Attacks Using Machine Learning)
**Zespół:** 4 osoby
**Status:** v2.0 — uwzględnia regulamin oceny i topic brief

> **Co się zmieniło względem v1.0:** wszystkie deliverables są zmapowane na 9 kryteriów Honeywella (33% oceny), dodaliśmy obowiązkowy Technical Report PDF, harmonogram zgrany z faktycznym schedule day 2, więcej modeli do porównania.

---

## 1. Vision (bez zmian)

GPS spoofing eksplodował 2024-2026 (Flight 8243, Hormuz, 1500+ samolotów dziennie). Hardware bierze lata. Budujemy software'ową warstwę AI która wykrywa spoofing w czasie rzeczywistym, działa multi-domain (aviation + maritime + drones), i tłumaczy każdą decyzję przez explainable AI.

**One-liner:** "Universal AI defense layer for civilian GPS — flags attacks in real time, explains every alert, deployable in weeks."

---

## 2. Punktacja i strategia (NOWA SEKCJA)

### Rozkład punktów

| Etap | Co | Max pkt | Topic-specific |
|---|---|---|---|
| Stage 1 Part I | Forma + materiały + wywiad | 70 | 30 |
| Stage 1 Part II | Code review | 30 | — |
| Stage 2 | Live presentation | 80 | 30 |
| **Razem** | | **180** | **60** |

**Krytyczne progi:**
- ✂️ Tylko **top HALFa** zespołów przechodzi Stage 1 Part I → Part II
- ✂️ Tylko **top 3** z kategorii przechodzą do Stage 2

### Strategia priorytetów

```
PRIORYTET 1 (must-hit, 0-12h dzień 1):
  → Solid pipeline ML: EDA, feature engineering, 4 modele, confusion matrix, SHAP
  → To zarabia 60 pkt topic-specific
  → To przepustka przez Stage 1

PRIORYTET 2 (must-hit, 12-20h):
  → Technical Report PDF (10-15 stron)
  → Live aviation tab z React + FastAPI + OpenSky
  → 3D Mapbox globe view (in-scope, kluczowy differentiator wizualny)
  → Voice LLM cockpit alerts (already mostly built)
  → Polished form submission text
  → To zarabia "First impression" + "App live presentation" + "Innovation factor"

PRIORYTET 3 (in-scope jeśli czas, 20-24h):
  → Maritime tab, drone replay
  → 3D trajectory ribbons (fake vs. real)
  → Cinematic camera flyTo na incident
  → Coverage discussion w PDF (multi-domain story)

PRIORYTET 4 (stretch, jeśli wszystko działa):
  → Blast dome 3D over spoofing source
  → WebSocket push alerts (zamiast polling)
  → Live drone simulation (PX4 SITL)
```

---

## 3. Mapping deliverables → kryteria Honeywella

**Każdy team member powinien znać tę tabelę na pamięć.**

| # | Kryterium Honeywella | Deliverable | Lokalizacja | Kto |
|---|---|---|---|---|
| 1 | Problem Understanding | Slide 1-3, opis w formie, intro PDF | Form + PDF + Pitch | D |
| 1 | Realistic spoofing scenarios | Trzy historical incidents w PDF | PDF rozdz. 2 | D |
| 1 | Relevant input signals identified | Tabela features z uzasadnieniem | PDF rozdz. 4 | C |
| 2 | Dataset size reported | "158k samples (4 klasy)" w PDF + slide | PDF rozdz. 3 | C |
| 2 | Class distribution shown | Bar chart per class | PNG + PDF + slide | C |
| 2 | Normal + anomalous cases | Description w PDF | PDF rozdz. 3 | C |
| 2 | Coverage discussed | "Authentic + 3 typy ataków" | PDF rozdz. 3 | C |
| 2 | Data quality checks | Missing/outliers analysis | PDF rozdz. 3.2 | C |
| 2 | Basic statistics | Mean/min/max table | PDF rozdz. 3.3 | C |
| 2 | Visualizations | Histograms, time-series, PCA | 5+ PNG plots | C |
| 2 | Dataset justification | Sekcja w PDF | PDF rozdz. 3.1 | C |
| 3 | Meaningful features | Engineered features lista | PDF rozdz. 4 | C |
| 3 | Each feature justified | Per-feature description | PDF rozdz. 4 | C |
| 3 | Feature distributions analyzed | Density plots normal vs spoofed | PNG + PDF | C |
| 3 | Normal vs anomalous comparison | Overlay distribution plots | PNG + PDF | C |
| 4 | Methods described/justified | Architecture sekcja | PDF rozdz. 5 + slide | C+D |
| 4 | Baseline considered | Logistic Regression jako baseline | PDF table | C |
| 4 | Limitations acknowledged | Dedykowana sekcja w PDF + slide | PDF rozdz. 9 | D |
| 5 | Clear pipeline | Pipeline diagram | PDF + architecture slide | B |
| 5 | Data properly split | "Stratified by mission" + caveat | PDF rozdz. 6 | C |
| 5 | Parameters described | Hyperparams table | PDF appendix | C |
| 5 | Implementation functional | Live demo + repo runs | demo + README | wszyscy |
| 6 | Evaluation aspects used | Detection rate, FPR, F1, AUC | PDF rozdz. 7 | C |
| 6 | Results in tables/plots | Tabele + ROC + PR curves | PDF + slide | C |
| 6 | Confusion matrix | Per model | PNG × 4 | C |
| 6 | Unseen test data | Held-out test set never touched | PDF method note | C |
| 7 | Multiple solutions compared | **4 modele tabelarycznie** | PDF rozdz. 7.5 + slide | C |
| 7 | Same metrics consistently | Tabela porównawcza | PDF + slide | C |
| 7 | Best solution evidence | Sekcja "Why XGBoost wins" | PDF rozdz. 7.6 | C |
| 8 | Results explained | Dyskusja per metryka | PDF rozdz. 8 | C+D |
| 8 | Failure cases identified | "Where model fails" sekcja | PDF rozdz. 8.2 | C+D |
| 8 | Trade-offs discussed | Detection vs FPR curve | PNG + PDF | C |
| 9 | Clear structure | PDF i slidy z TOC | PDF struktura | D |
| 9 | Figures/tables labeled | Numerowane, captioned | wszystkie pliki | wszyscy |
| 9 | Reproducible | README + requirements.txt + seeds | repo | B |

---

## 4. Deliverables (FINAL LIST)

### A) Project Submission Form (do 11:00 dzień 2)

Wypełnia kapitan. Zawiera:
- Opis problemu (1-2 paragrafy)
- Opis rozwiązania (1-2 paragrafy)
- Stack tech
- Link do repo
- Link do zasobów (Google Drive)

**Tekst formularza musi być przygotowany WCZEŚNIEJ**, nie pisany w pośpiechu. Osoba D pisze draft do północy dnia 1.

### B) Resources (Google Drive, do 12:00 dzień 2)

**Tylko PDF/PNG/MP4 są oceniane!**

```
/Resources
├── 01_Technical_Report.pdf            (10-15 stron, MAIN deliverable)
├── 02_Demo_Video.mp4                  (5 min, full demo flow)
├── 03_Architecture_Diagram.pdf        (1-pager)
├── 04_Plots/
│   ├── eda_class_distribution.png
│   ├── eda_cn0_histogram.png
│   ├── eda_pca_scatter.png
│   ├── eda_correlation_heatmap.png
│   ├── feature_distributions_normal_vs_spoof.png
│   ├── confusion_matrix_xgboost.png
│   ├── confusion_matrix_random_forest.png
│   ├── confusion_matrix_logreg.png
│   ├── confusion_matrix_isolation_forest.png
│   ├── roc_comparison_all_models.png
│   ├── precision_recall_curve.png
│   ├── shap_summary.png
│   ├── shap_force_plot_example.png
│   ├── feature_importance.png
│   └── tradeoff_detection_vs_fpr.png
└── 05_Screenshots/
    ├── dashboard_live_globe.png
    ├── dashboard_incident_replay.png
    ├── dashboard_onboard_detector.png
    └── dashboard_analytics.png
```

### C) Repo (link w formularzu)

```
/repo-root
├── README.md                  ← setup, run, reproducibility
├── requirements.txt           ← zablokowane wersje, seeds
├── Makefile                   ← make install / make dev / make demo
├── .env.example
├── frontend/                  ← React app
├── backend/                   ← FastAPI
├── ml/
│   ├── notebooks/
│   │   ├── 01_eda.ipynb
│   │   ├── 02_feature_engineering.ipynb
│   │   ├── 03_model_training.ipynb
│   │   └── 04_evaluation_and_shap.ipynb
│   ├── models/                ← .pkl serialized
│   └── data/                  ← Aissou + processed
├── data/
│   ├── incidents/             ← 3 historical JSON
│   └── samples/               ← demo data
└── docs/
    └── api.md                 ← endpoint contract
```

### D) Stage 2 Presentation (do 13:00 dzień 2)

- `.pptx` lub `.pdf`, max 20 MB
- Wysłana mailem na `kosciuszkon@samorzad.pk.edu.pl`
- 12-15 slajdów na 5-7 min mówienia
- Wszelkie dodatkowe materiały (video, GIF) muszą być też na Drive

---

## 5. Technical Report PDF — struktura (osoba C+D)

**Cel:** dokument który sam-w-sobie zdobywa max punktów z 9 kryteriów topic-specific.

```
0. Executive Summary                                   (0.5 str)
1. Introduction & Problem Statement                    (1 str)
   1.1 Why GPS spoofing matters (Flight 8243, Hormuz)
   1.2 Threat model and attack scenarios
   1.3 Our approach in one paragraph
2. Background & Related Work                            (1 str)
   2.1 Existing detection categories
   2.2 Why ML
3. Dataset Selection & EDA                              (2-3 str)
   3.1 Datasets considered + why we chose Aissou       ← criterion 2.8
   3.2 Data quality checks (missing, outliers)         ← criterion 2.5
   3.3 Basic statistics (mean, min/max table)          ← criterion 2.6
   3.4 Class distribution + coverage                   ← criterion 2.2-2.4
   3.5 Visualizations (4-6 plots)                      ← criterion 2.7
4. Feature Engineering                                  (1.5 str)
   4.1 Raw signals (C/N0, Doppler, pseudorange...)
   4.2 Engineered features + per-feature justification ← criterion 3.1-3.2
   4.3 Distribution analysis normal vs spoof           ← criterion 3.3-3.4
5. Methods                                              (1.5 str)
   5.1 Architecture overview
   5.2 Models tried + justification                    ← criterion 4.1
   5.3 Baseline (Logistic Regression)                  ← criterion 4.2
   5.4 Assumptions and limitations                     ← criterion 4.3
6. Implementation                                       (1 str)
   6.1 Pipeline diagram                                ← criterion 5.1
   6.2 Train/test/val split (stratified by mission)    ← criterion 5.2
   6.3 Hyperparameters per model                       ← criterion 5.3
   6.4 Reproducibility                                 ← criterion 5.4
7. Evaluation & Results                                 (2 str)
   7.1 Metrics chosen + why                            ← criterion 6.1
   7.2 Per-model results table                         ← criterion 6.2
   7.3 Confusion matrices (4 models)                   ← criterion 6.3
   7.4 ROC + PR curves                                  ← criterion 6.4
   7.5 Comparison table                                 ← criterion 7.1-7.2
   7.6 Why XGBoost wins (evidence)                      ← criterion 7.3
8. Interpretation & Discussion                          (1.5 str)
   8.1 SHAP analysis: top features per class           ← criterion 8.1
   8.2 Failure case analysis (3 examples)              ← criterion 8.2
   8.3 Detection rate vs FPR trade-off                 ← criterion 8.3
9. Limitations & Future Work                            (0.5 str)
   9.1 Dataset limitations (UAS, simulated)
   9.2 Adversarial robustness
   9.3 Roadmap (TEXBAT, OSNMA, sensor fusion)
10. Conclusions                                         (0.25 str)
    Appendix: full hyperparams, env, hardware
```

**Total: ~13 stron + appendix.** Generowane z notebooka osoby C, składane przez D w pretty PDF (LaTeX/Pandoc/Word→PDF — co kto woli, byle estetycznie).

---

## 6. Modele — final list (POSZERZONE)

Cztery modele na **identycznym splicie** z **identycznymi metrykami**:

| Model | Type | Lib | Czas trenowania | Plik |
|---|---|---|---|---|
| **Logistic Regression** | Linear baseline | sklearn | < 1 min | `logreg.pkl` |
| **Random Forest** | Bagging | sklearn | 1-3 min | `rf.pkl` |
| **XGBoost** | Gradient boosting | xgboost | 2-5 min | `xgb.pkl` |
| **Isolation Forest** | Unsupervised anomaly | sklearn | 30s | `isoforest.pkl` |

(Stretch: SVM RBF, ale tylko jeśli zostaje czas — może być wolny na większych dataset).

Każdy z **identycznymi**:
- random_state=42
- 5-fold cross validation
- Metrics: accuracy, precision, recall, F1, ROC-AUC, FPR@95%TPR
- Confusion matrix saved as PNG

---

## 7. Tech Stack (decyzje zamknięte — bez zmian)

(jak w v1.0)

**Frontend:** React 18 + Vite + TS + Mapbox GL JS + Tailwind + shadcn/ui + TanStack Query + Recharts
**Backend:** FastAPI + uvicorn + httpx + pydantic v2
**ML:** scikit-learn + xgboost + shap + pandas + joblib
**Voice (stretch):** Ollama Llama 3.1 8B + piper-tts

---

## 8. Team & Ownership (skorygowane wagi)

### 👤 Osoba A — Frontend Lead

**(rola: 3D globe i voice UI są CORE, nie stretch)**

Day 1 (0-12h): Vite + Mapbox 3D globe (projection: 'globe') + 4 taby + live aviation z `/api/flights/live`
Day 2 morning (12-20h): Incident replay z time slider, SHAP panel, **audio player z voice LLM integration** (Person D dostarcza endpoint), screenshots dla PDF
Day 2 noon (20-22h): 3D trajectory ribbons (fake vs. real), cinematic flyTo na incident, polish

**Core deliverables:**
- 3D globe view z animowanymi markerami (pulse na alercie)
- Voice alert player z BIP intro
- 4 czyste screenshoty 1920×1080 do PDF (do 9:00 dzień 2)

**Stretch:** blast dome 3D over spoofing source, WebSocket alerts

### 👤 Osoba B — Backend & Data

**(role bez zmian, dochodzą reproducibility deliverables)**

Day 1 (0-12h): FastAPI + OpenSky OAuth2 + trajectory model + endpointy
Day 2 morning (12-20h): AISStream, WebSocket, Stage 2 endpoints, README z `make install`
Day 2 noon (20-22h): Code cleanup pod jurorów, requirements.txt z pinned wersjami, .env.example

**NEW deliverable:** README + Makefile (criterion 5.4 reproducibility) (do 11:00 dzień 2)

### 👤 Osoba C — ML & Insights ⚠️ NAJWIĘKSZE ZMIANY

**Zmiany:** dochodzi 2 dodatkowe modele, znacząco rozbudowany Technical Report.

**Day 1 (0-12h):**
- EDA notebook z **wszystkimi wymaganymi plotami** (criterion 2: 6+ wizualizacji)
- Feature engineering notebook z **per-feature justification** (criterion 3)
- **4 modele** wytrenowane na tym samym splicie (criterion 7)
- SHAP integration

**Day 2 morning (12-20h):**
- Confusion matrix per model (4 PNG)
- ROC + PR curves wszystkich modeli na jednym wykresie
- SHAP plots (summary + force plot)
- Failure case analysis (3 konkretne przykłady gdzie modele się mylą)
- Trade-off curve (detection rate vs FPR)
- Wszystkie wykresy eksportowane jako PNG do `/Resources/04_Plots/`

**Day 2 noon (20-22h):**
- Wsparcie D w pisaniu Technical Report (sekcje 3-8)
- Drone tab demo (PX4 log replay) — DOWNGRADED do MP4 video, nie live demo

**NEW deliverable:** wszystkie PNG plots gotowe do **9:00 dzień 2** dla PDF.

### 👤 Osoba D — Voice/LLM, Demo Producer & **Document Lead** ⚠️ NAJWIĘKSZE ZMIANY

**Zmiany:** zostaje storytellerem ALE **przejmuje też pisanie Technical Report PDF i tekstu submission form**.

**Day 1 (0-12h):**
- Research 3 historical incidents (JSON-y)
- Ollama setup + pierwsze prompty
- piper-tts test
- **Draft tekstu submission form** (do północy dnia 1!)
- **Outline Technical Report** (struktura, captions placeholdery)

**Day 2 morning (8:00-12:00 — krytyczne!):**
- **8:00 składanie Technical Report PDF** z plotów C i sekcji od C → finalizacja **do 11:00**
- 9:00-11:00 **wypełnianie submission form** z dopracowanym tekstem
- Architecture diagram PDF
- Demo video recording (zaczyna ok. 11:00)

**Day 2 noon (12-14h):**
- Slide deck final (12-15 slajdów)
- Pitch rehearsal × 3
- Backup video + backup MP3 voice alerts

**NEW deliverable lista:**
- Submission form text (gotowy 8:00 dzień 2)
- Technical Report PDF (gotowy 11:00 dzień 2)
- Architecture diagram (gotowy 11:00 dzień 2)
- Demo video MP4 (gotowy 12:00 dzień 2)
- Pitch deck PDF (wysyłka 13:00 dzień 2)

---

## 9. Timeline (skorygowany pod faktyczny schedule)

### DZIEŃ 1 (kodowanie startuje, zazwyczaj 17:00 lub późnym popołudniem)

| Godzina od startu | Hour 0-2 | Setup |
|---|---|---|
| Hour 2-8 | First slice | A: globe + mock data; B: OpenSky OAuth2 working; C: EDA notebook + Aissou loaded; D: 3 incidents JSONs + Ollama installed |
| Hour 8-12 | Vertical | A: live aviation tab; B: trajectory model; C: **4 modele wytrenowane**; D: Ollama prompt + first MP3 |
| Hour 12-16 | Integration | A: incident replay UI; B: AISStream; C: confusion matrices + SHAP plots; D: **draft submission form text** |

**Sync meetings:** Hour 2, 8, 12 (15 min, status + blockers).

### NOC (Hour 16-20+ — 4-6h snu rozłożone)

- A+B: śpią 02:00-06:00
- C+D: śpią 22:00-02:00

### DZIEŃ 2 (godzina absolutna)

| Czas | Co | Kto |
|---|---|---|
| **6:00-8:00** | Final polish + plots export | C, A |
| **8:00-9:00** | **Topic declaration form** | Captain |
| **8:00-11:00** | Technical Report PDF assembly | D + C support |
| **9:00-11:00** | **Submission form filling** | D + Captain |
| **11:00-12:00** | Resources upload na Drive (PDF, PNG, MP4) | D |
| **11:00-13:00** | Final code commits + Demo video recording | wszyscy |
| **12:00** | DEADLINE: dokumenty na Drive | — |
| **12:30** | Pitch rehearsal #1 | wszyscy |
| **13:00** | **HARD STOP kodowania**, prezentacja na mail | — |
| **13:00-14:00** | Pitch rehearsal #2 i #3 | wszyscy |
| **14:00** | **Wyłonienie top 3** | jury |
| **14:00-15:30** | **Stage 2 — pitch live** (jeśli w top 3) | wszyscy |
| **15:30-16:30** | Narada jury, ogłoszenie wyników | — |

---

## 10. Submission Form — szablon tekstów

**Aby D nie pisał tego o 9:30 dnia 2, draft GOTOWY do 22:00 dnia 1.**

### Project Title
GPS Spoofing Sentinel — Domain-Agnostic AI Defense for Civilian GPS

### Problem Description (1-2 paragrafy)
GPS spoofing has emerged as one of the most serious systemic vulnerabilities of modern civilian infrastructure. Between 2024 and 2026, recorded incidents grew over 500% — from 300 to 1500+ aircraft per day at peak (OPSGROUP/IATA), with the Strait of Hormuz seeing 1100+ ships disrupted in a single 24-hour window in June 2025, and the Azerbaijan Airlines Flight 8243 tragedy (38 fatalities, December 2024) demonstrating that spoofing now amplifies kinetic threats. Aviation, maritime, drones, and connected vehicles all share the same exposed civilian GPS rail.

While hardware-based defenses (CRPA antennas, hybrid INS systems like Honeywell's LASEREF VI and HANA) provide strong protection, they require years of certification and fleet rollout. Software-based machine learning detection can deploy in weeks across existing infrastructure — providing a complementary defense layer. Our project addresses this gap.

### Solution Description (1-2 paragrafy)
We deliver a **two-tier ML defense layer** with a unified web dashboard. Tier 1 (on-board) uses an XGBoost classifier trained on raw GNSS signal features (C/N0, Doppler, pseudorange) from the Aissou et al. UAV dataset, classifying receiver-level signal authenticity at 3 ms inference. Tier 2 (network-side) applies an Isolation Forest anomaly detector to ADS-B trajectory features (position jumps, velocity inconsistency, NIC drops) from live OpenSky Network data, flagging suspicious aircraft across an entire airspace. We benchmark four models (Logistic Regression baseline, Random Forest, XGBoost, Isolation Forest) on identical splits and metrics, achieving F1 ≥ 0.95 on the on-board model. Every alert is explained via SHAP, satisfying aviation's interpretability requirement.

The same engine demonstrably generalizes across aviation (live ADS-B), maritime (live AIS), and drones (PX4 log replay), proving the domain-agnostic claim. Our deliverable is a React+FastAPI dashboard with live globe view, three historical incident replays (Flight 8243, Hormuz, Beirut), and optional voice cockpit alerts (LLM+TTS).

### Technologies Used
React 18, Vite, TypeScript, Mapbox GL JS, Tailwind, shadcn/ui, TanStack Query, FastAPI, Python 3.11, scikit-learn, XGBoost, SHAP, pandas, OpenSky Network OAuth2 API, AISStream WebSocket, Ollama (Llama 3.1 8B), piper-tts.

### Repository link
`https://github.com/[team]/gps-spoofing-sentinel`

### Resources link
`https://drive.google.com/drive/folders/[folder_id]`

---

## 11. Risks & Mitigations (zaktualizowane)

| Ryzyko | Mitygacja |
|---|---|
| Nie zdążymy z PDF do 11:00 | D zaczyna draft 22:00 dnia 1, plot placeholdery zamieniane na realne plots rano |
| Form submission form pisany w pośpiechu | **Tekst gotowy 22:00 dnia 1**, kapitan tylko paste'uje |
| Nie zdążymy 4 modeli — tylko 2 | Logistic Regression + Random Forest to **15 min** w sklearn, BEZ kompromisu |
| Drive permissions zablokowane | Test linku z innego konta + share publicznie z dostępem przez link |
| Notebooki edytowalne nie liczą się | Notebooki w repo (technical eval), wyniki jako PNG w resources |
| OpenSky rate limit | Cache 15s, AISStream/ADSB.lol fallback |
| Voice LLM padnie na demo | **Backup MP3** dla 3 incydentów pre-recordowane (już zaimplementowane) |
| 3D globe lagguje przy >500 markerach | Klastrowanie + LOD per zoom, cap markerów na 200 wizualnych |
| Mapbox token limit (50k loads/mc) | Dla hackathonu wystarczy z zapasem; w demo nie odświeżamy ręcznie |
| Kod nieczytelny dla code review | B robi cleanup pod sam koniec dnia 1, README sample run |

---

## 12. Demo flow — Stage 2 (5-7 min, scripted)

**Cel:** wszystkie 9 kryteriów Honeywella + innowacja + spójność z submission.

```
00:00-01:00  HOOK — Problem (criterion 1)
  D: hybrid warfare numbers, Flight 8243, Hormuz
  Slide z heatmapą + zdjęciami "ships at airport"

01:00-02:00  DATA & EDA (criterion 2-3)
  C lub D: "Aissou dataset, 158k samples, 4 klasy"
  Slide: class distribution + feature distributions normal vs spoof

02:00-03:30  METHOD & RESULTS (criterion 4-7)
  C lub D: 4 modele table, XGBoost wins, why
  Slide: comparison table + 2 confusion matrices side-by-side

03:30-05:00  LIVE DEMO
  A klika dashboard: live globe → klik na alert → SHAP slide-in
  Incident replay: Flight 8243 z time slider
  Audio: BIP + voice alert (live LLM lub backup MP3)
  Drone tab: GPS-IMU divergence chart

05:00-05:45  INTERPRETATION (criterion 8)
  D: failure cases, trade-off detection vs FPR
  Slide: trade-off curve + 1 failure example

05:45-06:30  LIMITATIONS & HONEYWELL TIE
  D: limitations (UAS data, adversarial)
  Slide: roadmap + LASEREF VI / HANA komplementarność

06:30-07:00  CLOSE
  D: "Hardware lata, software jutro. Domain-agnostic. Deployable w tygodniach."
  Last slide: repo + QR
```

---

## 13. Q&A drill — top 12 pytań

1. Dlaczego nie OSNMA / kryptografia? → komplementarne, OSNMA wymaga nowego HW
2. Co z adversarial attacks na model? → defense in depth (limitations slide)
3. False positive rate? → < 2% na test set, próg konfigurowalny
4. Honeywell ma już rozwiązania, co waszego? → software vs hardware, deploy w tygodniach
5. Skąd wiecie że Hormuz = spoofing? → Windward + USCG raporty, 100 ships at airport pattern
6. Ile danych testowych? → 20% held-out, stratified by mission
7. Latencja inference? → 3ms XGBoost, 50-100ms SHAP
8. Czy działa offline? → tak, modele i Ollama lokalne
9. Dlaczego XGBoost a nie deep learning? → 4 modele porównane, XGB wygrał na F1 i latency
10. Jak generalizuje na nowe ataki? → Isolation Forest unsupervised + SHAP wykrywa nieznane
11. Czy testowaliście na lotniczych danych? → Aissou to UAS, future work TEXBAT/OSNMA
12. Jak rozumiecie reproducibility? → README + Makefile + pinned requirements + seeds

---

## 14. Definition of Done (checklist v2.0)

### Stage 1 (do 11:00 dzień 2)
- [ ] Topic declared (8:00-9:00)
- [ ] Submission form completed (text dopracowany dzień 1)
- [ ] Repo URL publicznie dostępny
- [ ] Drive URL publicznie dostępny
- [ ] **Technical Report PDF** na Drive
- [ ] **15+ PNG plots** na Drive
- [ ] **Demo video MP4** na Drive (do 12:00)
- [ ] **Architecture diagram PDF** na Drive
- [ ] 4 screenshots dashboardu na Drive

### Code (do 13:00 dzień 2)
- [ ] README.md z `make install` / `make demo`
- [ ] requirements.txt pinned
- [ ] 4 modele wytrenowane i serializowane
- [ ] Notebooks 01-04 czytelne
- [ ] FastAPI + frontend działają end-to-end na czystej maszynie
- [ ] **3D Mapbox globe renderuje się płynnie** (60fps na średnim laptopie)
- [ ] **Voice LLM cockpit alert** generuje się dla minimum 1 incident end-to-end
- [ ] Backup MP3 voice alerts dla 3 incydentów (gdyby Ollama padł na demo)

### Stage 2 (do 13:00 dzień 2 mailem)
- [ ] Pitch deck .pptx/.pdf < 20MB wysłana
- [ ] Pitch zgrany 5-7 min, 3× rehearsed
- [ ] Backup video gotowe
- [ ] Q&A drill zrobiony

---

## 15. Co się NIE zmieniło

- Vision i pitch
- Tech stack
- Architektura systemu
- 3 historical incidents w demo
- Multi-domain scope (aviation primary, maritime + drone secondary)
- 4-osobowy team i podstawowy podział ról

## 16. Co się zmieniło w v2.1

- **3D Mapbox globe** — teraz CORE deliverable (był stretch w v1.0). Differentiator wizualny w live demo.
- **Voice LLM cockpit alerts** — teraz CORE deliverable (był stretch w v1.0). Większość już zaimplementowana, niskie ryzyko.
- **3D ribbons / cinematic flyTo / blast dome** — pozostają jako opcjonalne stretch goals, dorzucane jeśli czas po godz. 20 dnia 1.

---

*Dokument: v2.1, hackathon Honeywell Kościuszkon 2026 — 3D globe i voice LLM potwierdzone jako CORE*

# Frontend Upgrade PRD — GNSS Defense Monitor v0.3
## Target: Claude Code execution

**Project:** GPS Spoofing Sentinel / GNSS Defense Monitor
**Hackathon:** Honeywell Kościuszkon 2026
**Scope:** Frontend only (Next.js 16 / React 19 / TypeScript)
**Goal:** Transform the working v0.2 FE into a 10/10 pitch-ready production-grade demo
**Time budget:** 6–10 hours of focused execution

---

## 0. Context for Claude Code

**Current state (v0.2 — already working):**
- Next.js 16.2.6 + React 19.2.4 + TypeScript 5
- Tailwind v4 (PostCSS plugin)
- react-leaflet@5 + leaflet@1.9 (CARTO 2D dark tiles, **not 3D**)
- recharts@3.8 (in deps but unused)
- lucide-react@1.14
- Three modes: `onboard | live_globe | replay`
- 5 hardcoded scenarios (normal_waw_gdn, texbat_spoof, aissou_channel_attack, baltic_teleport, smooth_drift_fleet)
- Backend reachable at `${API_BASE}` with REST + WebSocket
- ExplainModal already wired to `/api/explain/{id}-{tick}` with real SHAP rendering
- AlertSystem uses Web Audio beeps (sine waves) — does NOT call `/api/alerts/{id}/speak`
- Backend exposes but FE doesn't use: `/api/flights`, `/api/ships`, `/api/incidents`, `/api/score`, `/api/alerts/{id}/speak`
- F1 numbers hardcoded in components instead of pulled from `/api/health`
- No demo assets in `frontend/public/` beyond Next boilerplate SVGs

**Critical constraint — Next.js 16 specifics:**
The `AGENTS.md` warns: "This is NOT the Next.js you know." Next 16 has breaking changes vs. typical training data. **Default to client components (`"use client"`) for everything that uses hooks, Mapbox, audio, or WebSocket.** Do not assume App Router server actions, async page params, or edge runtime patterns work as documented in older sources unless you can verify in the existing codebase.

**Mapbox token:** Provided via `NEXT_PUBLIC_MAPBOX_TOKEN` env var. Do NOT hardcode, do NOT commit. Read `process.env.NEXT_PUBLIC_MAPBOX_TOKEN` at component init time, fail gracefully with a banner if missing.

---

## 1. Goals & Non-Goals

### Goals
1. **3D globe with cinematic flight visualization** replacing 2D Leaflet (Mapbox + 3D aircraft GLTF models + smooth trajectory ribbons)
2. **shadcn/ui design system** across all components (consistent dark theme, Honeywell red #EE3124 as accent)
3. **Analytics mode** as a fourth tab — ML model insights, fleet stats, comparison table, incident gallery
4. **Incident replay narrative framing** — Flight 8243, Hormuz, Beirut as named scenarios with story scaffolding
5. **Voice LLM integration** — Web Audio `<audio>` element calling `/api/alerts/{id}/speak`, falling back to existing beep
6. **Polish & motion design** — Framer Motion transitions, skeleton loaders, empty states, status microinteractions
7. **F1/metrics from backend** — eliminate hardcoded numbers, fetch from `/api/health` and per-scenario sources

### Non-Goals (explicitly OUT)
- Backend changes (zero edits to `backend/`)
- New ML models, training, or evaluation logic
- Authentication, multi-user, persistence beyond localStorage for user prefs
- Mobile responsive perfection (target 1920×1080 demo screen, gracefully degrade to 1366×768)
- Internationalization framework (Polish strings stay hardcoded as they are)
- Removing existing 2D Leaflet code that still works in Replay mode (we add Mapbox alongside, not replace blindly)
- Tests beyond what already exists

### Success criteria (Definition of Done)
- [ ] All 4 modes (Onboard / Live Globe / Replay / **Analytics**) render without console errors
- [ ] 3D globe renders aircraft as GLTF models that rotate and tilt with heading/bank
- [ ] Smooth trajectory ribbons follow each plane with fade-out tail
- [ ] CRITICAL alerts trigger: full-screen flash + 3D camera focus + voice LLM playback
- [ ] At least 3 named historical incidents in Replay mode (Flight 8243, Hormuz, Beirut) with narrative panel
- [ ] Analytics tab shows: per-model F1 from `/api/health`, confusion-matrix-like 4-quadrant viz, top-N feature importances, incidents map
- [ ] All major surfaces use shadcn/ui primitives (Button, Card, Dialog, Tabs, Tooltip, Sheet, Badge, Toast)
- [ ] No regression: existing scenarios still play, ExplainModal still works, mock mode still functional
- [ ] Page-load Lighthouse Performance ≥ 70 on M2 MacBook (we tolerate sacrifices for visual richness)

---

## 2. Tech Stack — what to add

```bash
# Core additions
npm i mapbox-gl@^3                       # 3D globe, terrain, atmosphere, sky
npm i -D @types/mapbox-gl
npm i three@^0.171 @types/three          # 3D aircraft models in custom layer
npm i framer-motion@^12                  # transitions, micro-interactions
npm i sonner@^2                          # toast notifications (replacing custom toast)
npm i zustand@^5                         # global UI state (selected aircraft, mode, audio prefs)
npm i clsx tailwind-merge                # class composition (shadcn standard)
npm i class-variance-authority           # shadcn variant API
npm i @radix-ui/react-* (selectively, via shadcn add)
npm i d3-geo @types/d3-geo               # great-circle geometry for trajectory smoothing

# shadcn/ui CLI
npx shadcn@latest init
# Then add components individually as needed:
# button, card, dialog, sheet, tabs, badge, tooltip, sonner, separator, scroll-area,
# skeleton, popover, select, slider, switch, command, dropdown-menu, avatar
```

**Already in deps (use these, don't replace):** `react-leaflet`, `leaflet`, `recharts`, `lucide-react`, `tailwindcss v4`.

**Aircraft GLTF model:** Use a free, CC0-licensed model. Recommended: a clean low-poly civilian airliner from Sketchfab or Kenney's airplane pack. Download to `frontend/public/models/aircraft.glb` (target < 200 KB). Fallback to a simple cone/extruded triangle in three.js if model fails to load.

---

## 3. Information Architecture

### 3.1 Navigation (4 modes, replacing current 3)

```
[ Sentinel logo ]  Onboard  |  Live Globe  |  Replay  |  Analytics    [ scenario select ]  [ status pills ]  [ export ]
```

- **Onboard Monitor** — keep current functionality, upgrade with shadcn primitives + animations
- **Live Globe** — replace Leaflet with Mapbox 3D globe + GLTF aircraft + trajectory ribbons + spoofing arc overlays
- **Replay** — keep timeline scrubber excellence, add **Incident Library** drawer + narrative framing
- **Analytics** *(NEW)* — model insights, comparison table, incident heatmap, fleet stats

Mode switching remains React state (no router changes).

### 3.2 Global state (Zustand)

```ts
// frontend/lib/stores/ui-store.ts
interface UIState {
  mode: Mode;
  scenarioId: string;
  selectedAircraftId: string | null;
  audioEnabled: boolean;
  voiceLLMEnabled: boolean;       // NEW — toggle between beep and TTS
  cameraFollowMode: 'free' | 'follow' | 'cinematic';  // NEW — for 3D globe
  alertsHistory: AlertEvent[];
  mockMode: boolean;

  // actions
  setMode: (m: Mode) => void;
  selectAircraft: (id: string | null) => void;
  toggleAudio: () => void;
  toggleVoiceLLM: () => void;
  setCameraMode: (m: 'free' | 'follow' | 'cinematic') => void;
  pushAlert: (a: AlertEvent) => void;
}
```

Migrate state currently in `dashboard-client.tsx` `useState` hooks into this store. Keep tick/score data in component state (high-frequency, no need to globalize).

---

## 4. Detailed Component Specs

### 4.1 Design System Foundation

**File:** `frontend/lib/design-tokens.ts`
```ts
export const tokens = {
  colors: {
    honeywell: '#EE3124',
    honeywellDark: '#B81C12',
    bgBase: 'rgb(2, 6, 23)',          // slate-950
    bgPanel: 'rgb(15, 23, 42)',       // slate-900
    bgPanelHover: 'rgb(30, 41, 59)',  // slate-800
    border: 'rgba(148, 163, 184, 0.12)',
    borderStrong: 'rgba(148, 163, 184, 0.25)',
    textPrimary: 'rgb(241, 245, 249)',
    textSecondary: 'rgb(148, 163, 184)',
    textMuted: 'rgb(100, 116, 139)',
    verdictOk: 'rgb(16, 185, 129)',     // emerald-500
    verdictWarn: 'rgb(245, 158, 11)',   // amber-500
    verdictCrit: 'rgb(239, 68, 68)',    // red-500
    accentCyan: 'rgb(34, 211, 238)',    // for L1 channel
    accentViolet: 'rgb(139, 92, 246)',  // for L2 channel
  },
  motion: {
    fast: 0.15,
    base: 0.25,
    slow: 0.4,
    spring: { type: 'spring', stiffness: 300, damping: 30 },
  },
};
```

**Use these everywhere.** No raw hex colors in components except for one-off chart needs.

### 4.2 Top Bar (`top-bar.tsx`)

Replace current implementation with shadcn-based:

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ [📡 Sentinel]  GNSS DEFENSE MONITOR     [Onboard|Live Globe|Replay|Analytics] [Scenario▾] │
│              KOŚCIUSZKON 2026 · HONEYWELL                                                 │
│                                                            [🟡 Mock] [⚡12ms] [📥 Export]│
└──────────────────────────────────────────────────────────────────────────────────────────┘
```

- Logo: animated radar pulse (Framer Motion `motion.div` with infinite rotate + scale pulse)
- Mode buttons: shadcn `Tabs` component, active tab gets `bg-honeywell` background with subtle glow shadow
- Scenario select: shadcn `Select` with custom trigger showing scenario type icon (✈️ onboard, 🌍 globe)
- Status pills: shadcn `Badge` with `variant` for mock/connected/error
- Export button: shadcn `Button` `variant="outline"`

**Animations:**
- Mode switch: 200ms ease-out underline slide between tabs
- Mock mode pill: gentle yellow pulse when active
- Latency badge: color shifts smoothly green→yellow→red as ms increases

### 4.3 Onboard Monitor — shadcn refactor

Keep current layout (header card / two ScoreBars / TopReasons / Alert feed / stats row). Refactor:

- Wrap each section in shadcn `Card` (`Card`, `CardHeader`, `CardTitle`, `CardContent`)
- Replace inline buttons with shadcn `Button`
- Replace verdict pill with custom `Badge` variants: `verdict-ok`, `verdict-warn`, `verdict-crit`
- Add `Tooltip` on every metric (lat/lon/alt/heading) explaining what it means in plain Polish
- Add `Skeleton` loader when `tick` is null instead of "Waiting for first tick…" plain text
- ScoreBar: keep sparkline canvas, add Framer Motion `layout` animation when value changes
- Alert feed: use shadcn `ScrollArea` for proper scrolling, max-height 600px

**New micro-feature — "Recent verdicts mini-strip":**
Below the header card, a horizontal strip of last 30 ticks as 4×30 colored squares. OK=green, WARN=amber, CRIT=red dot per tick. Hover shows tooltip with tick number. Gives at-a-glance temporal density of attacks.

### 4.4 Live Globe — Mapbox 3D *(biggest change)*

**File:** `components/live-globe/mapbox-globe.tsx` (NEW, replaces `globe-map.tsx` for live mode only — replay keeps Leaflet for now)

#### 4.4.1 Map initialization

```tsx
"use client";
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/css/mapbox-gl.css';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

useEffect(() => {
  if (!MAPBOX_TOKEN) {
    setError('Brak klucza Mapbox — dodaj NEXT_PUBLIC_MAPBOX_TOKEN do .env.local');
    return;
  }
  mapboxgl.accessToken = MAPBOX_TOKEN;
  const map = new mapboxgl.Map({
    container: containerRef.current!,
    style: 'mapbox://styles/mapbox/dark-v11',     // dark base
    projection: { name: 'globe' },                 // ← THE 3D GLOBE
    center: [18, 54],
    zoom: 4,
    pitch: 45,
    bearing: 0,
    antialias: true,
  });

  map.on('style.load', () => {
    map.setFog({                                   // atmosphere effect
      color: 'rgb(15, 23, 42)',
      'high-color': 'rgb(30, 41, 59)',
      'horizon-blend': 0.05,
      'space-color': 'rgb(2, 6, 23)',
      'star-intensity': 0.5,
    });

    // 3D terrain (subtle, doesn't dominate the scene)
    map.addSource('mapbox-dem', {
      type: 'raster-dem',
      url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
      tileSize: 512,
      maxzoom: 14,
    });
    map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.2 });

    // sky layer for high-altitude views
    map.addLayer({
      id: 'sky',
      type: 'sky',
      paint: {
        'sky-type': 'atmosphere',
        'sky-atmosphere-sun': [0.0, 90.0],
        'sky-atmosphere-sun-intensity': 5,
      },
    });
  });
}, []);
```

#### 4.4.2 3D aircraft models — three.js custom layer

This is the critical part. Mapbox accepts `type: 'custom'` layers that get the WebGL context. We attach three.js to render GLTF aircraft models that respect the globe curvature.

**File:** `components/live-globe/aircraft-layer.ts`

```ts
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import mapboxgl from 'mapbox-gl';

interface AircraftEntity {
  id: string;
  lat: number;
  lon: number;
  alt_ft: number;
  heading_deg: number;
  bank_deg?: number;
  pitch_deg?: number;
  verdict: 'ok' | 'warn' | 'crit';
}

export class AircraftLayer implements mapboxgl.CustomLayerInterface {
  id = 'aircraft-3d-layer';
  type = 'custom' as const;
  renderingMode = '3d' as const;

  private scene = new THREE.Scene();
  private camera = new THREE.Camera();
  private renderer!: THREE.WebGLRenderer;
  private map!: mapboxgl.Map;
  private template?: THREE.Group;
  private instances = new Map<string, THREE.Group>();

  async onAdd(map: mapboxgl.Map, gl: WebGL2RenderingContext) {
    this.map = map;
    this.renderer = new THREE.WebGLRenderer({
      canvas: map.getCanvas(),
      context: gl,
      antialias: true,
    });
    this.renderer.autoClear = false;

    // Lighting — dim ambient + directional for nice plane shading
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    const sun = new THREE.DirectionalLight(0xffffff, 1.0);
    sun.position.set(0.5, 1, 0.3).normalize();
    this.scene.add(ambient, sun);

    // Load template once
    const loader = new GLTFLoader();
    const gltf = await loader.loadAsync('/models/aircraft.glb');
    this.template = gltf.scene;
    // Normalize size — Mapbox uses Mercator units; we'll scale per instance
  }

  updateAircraft(aircraft: AircraftEntity[]) {
    const seen = new Set<string>();
    for (const a of aircraft) {
      seen.add(a.id);
      let mesh = this.instances.get(a.id);
      if (!mesh && this.template) {
        mesh = this.template.clone(true);
        this.instances.set(a.id, mesh);
        this.scene.add(mesh);
      }
      if (!mesh) continue;

      // Tint by verdict
      mesh.traverse((node) => {
        if ((node as THREE.Mesh).isMesh) {
          const m = node as THREE.Mesh;
          const color = a.verdict === 'crit' ? 0xef4444
                      : a.verdict === 'warn' ? 0xf59e0b
                      : 0x10b981;
          (m.material as THREE.MeshStandardMaterial).color.setHex(color);
          (m.material as THREE.MeshStandardMaterial).emissive.setHex(color);
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity =
            a.verdict === 'crit' ? 0.6 : 0.2;
        }
      });

      // Position on globe
      const meters = a.alt_ft * 0.3048;
      const merc = mapboxgl.MercatorCoordinate.fromLngLat(
        [a.lon, a.lat],
        meters
      );
      const scale = merc.meterInMercatorCoordinateUnits();

      mesh.position.set(merc.x, merc.y, merc.z);
      mesh.scale.setScalar(scale * 5000);  // tune this — aircraft visible from zoom 3+
      mesh.rotation.set(
        THREE.MathUtils.degToRad(a.pitch_deg ?? 0),
        THREE.MathUtils.degToRad(-a.heading_deg),
        THREE.MathUtils.degToRad(a.bank_deg ?? 0),
        'YXZ'
      );
    }

    // Remove stale
    for (const [id, mesh] of this.instances) {
      if (!seen.has(id)) {
        this.scene.remove(mesh);
        this.instances.delete(id);
      }
    }
  }

  render(_gl: WebGL2RenderingContext, matrix: number[]) {
    this.camera.projectionMatrix = new THREE.Matrix4().fromArray(matrix);
    this.renderer.resetState();
    this.renderer.render(this.scene, this.camera);
    this.map.triggerRepaint();
  }
}
```

**Aircraft GLTF model requirements:**
- Place at `frontend/public/models/aircraft.glb`
- Recommended: simple low-poly civilian jet, neutral white color (we tint per verdict at runtime)
- Sources: Kenney.nl airplane pack (CC0), Sketchfab "low poly airliner" CC0 filter, or build a placeholder cone in three.js if missing
- File size target < 200 KB
- Up axis: Y (we rotate to match Mapbox conventions in code above)

**Fallback if GLTF load fails:** Render a simple `THREE.ConeGeometry` extruded into a plane silhouette. Log warning, don't crash.

#### 4.4.3 Trajectory ribbons

For each tracked aircraft, maintain a rolling buffer of last 60–120 positions. Render as an animated polyline that fades from full opacity at the head to 0 at the tail.

Two implementation paths — pick whichever is simpler with current Mapbox version:

**Path A (recommended):** Mapbox `line` layer with `line-gradient` paint property:
```ts
map.addSource(`trail-${id}`, {
  type: 'geojson',
  lineMetrics: true,
  data: { type: 'Feature', properties: {}, geometry: {
    type: 'LineString', coordinates: positions
  }}
});
map.addLayer({
  id: `trail-${id}`,
  type: 'line',
  source: `trail-${id}`,
  paint: {
    'line-color': verdictColor,
    'line-width': 2,
    'line-gradient': [
      'interpolate', ['linear'], ['line-progress'],
      0, 'rgba(0,0,0,0)',     // tail transparent
      1, verdictColor          // head full color
    ],
  }
});
```

Update by calling `setData()` on the source every tick.

**Path B:** three.js `Line2` with custom shader for fade. More flexible, more code. Skip for now.

#### 4.4.4 Spoofing arc overlay

When an aircraft is in CRITICAL state, draw a curved arc from its **reported (fake) position** to its **inferred true position** in deep red.

- Use `mapbox-gl` `line` layer with `line-dasharray: [2, 2]` for the arc
- Compute great-circle interpolation between two points (use `d3-geo`'s `geoInterpolate`)
- Animate the dash offset to give "pulsing flow" effect
- Add `mapboxgl.Marker` with custom HTML pulsing dot at the spoofer-estimated source

If true position isn't known (live mode), skip the arc and instead render a **divergence indicator**: short red line perpendicular to heading showing "drift direction."

#### 4.4.5 Camera modes

UI toggle (shadcn `ToggleGroup`) — three modes:
1. **Free** — user controls, default Mapbox behavior
2. **Follow** — selected aircraft stays centered, camera tracks position with smooth lerp
3. **Cinematic** — when CRITICAL alert fires, camera does an automated `flyTo()` to selected aircraft with `pitch: 60, zoom: 9, bearing: aircraft.heading - 30, duration: 2500, essential: true`

Cinematic mode is the WOW moment. Trigger automatically on first CRIT alert per scenario, then switch back to follow.

#### 4.4.6 Performance budget

- Target 60fps on M2 with up to 200 visible aircraft
- Cap visible aircraft to top-50 by spoofing score in render
- Use object pooling: 50 GLTF instances pre-allocated, hidden vs. visible toggle
- Throttle position updates to map at most 30Hz (use `requestAnimationFrame` interpolation between WS ticks)

### 4.5 Replay Mode + Incident Library *(narrative framing)*

#### 4.5.1 Incident Library Drawer

Slide-out drawer (shadcn `Sheet` component) opens from the right. Shows a list of named historical incidents fetched from `/api/incidents`.

Each card:
```
┌──────────────────────────────────────────────┐
│ [thumbnail]  AZAL Flight 8243                │
│              25 December 2024 · Caspian Sea  │
│              "Lost GPS over Grozny, was      │
│              sent across Caspian to crash."  │
│              [▶ Play with Sentinel]          │
└──────────────────────────────────────────────┘
```

If `/api/incidents` returns empty/404 (frontend in mock mode), fall back to 3 hardcoded incidents in `frontend/lib/incidents-fallback.ts`:
1. **AZAL Flight 8243** — 25 Dec 2024, Grozny → Aktau
2. **Strait of Hormuz Mass Spoofing** — June 2025, 1,100+ ships in 24h
3. **Beirut Airport Ghost Fleet** — April 2024, 117 ships displayed at airport

Each fallback incident has: `id`, `title`, `date`, `region`, `narrative` (2-3 sentence summary), `casualties` (optional), `attack_pattern`, `linked_scenario_id` (which existing scenario CSV best demonstrates this).

#### 4.5.2 Narrative Side Panel

When an incident is loaded, replace the right-hand content with:

```
┌────────────────────────────────────────┐
│ ✈️ AZAL Flight 8243                    │
│ 25 December 2024                       │
│                                        │
│ ━━━━━ TIMELINE ━━━━━                   │
│                                        │
│ T+00:00  GPS integrity normal          │
│ T+04:23  ⚠ NIC drop detected           │
│ T+04:35  🚨 Spoofing confirmed         │
│           Sentinel: ALERT to crew      │
│ T+05:12  Crew reverts to inertial      │
│           [In real life: 8 minutes]    │
│ T+12:00  Aircraft diverts to Aktau     │
│                                        │
│ ━━━━━ OUR DETECTION ━━━━━              │
│                                        │
│ Time saved: ~7 minutes                 │
│ Confidence: 0.91                       │
│ Top features:                          │
│  • C/N0 anomaly on 6/8 channels        │
│  • Doppler inconsistency               │
│  • Position jump 1.2 km                │
│                                        │
│ [Replay 0.5×]  [Replay 1×]  [Replay 2×]│
└────────────────────────────────────────┘
```

This is what closes the emotional sale. Build it carefully.

#### 4.5.3 Timeline Scrubber upgrade

Existing `timeline-scrubber.tsx` is already excellent. Augment with:
- Annotation markers from the incident narrative ("NIC drop", "Spoofing detected", "Recovery") — small icons above the scrubber at corresponding ticks
- Tooltip on hover shows the annotation
- Add a small "Sentinel detected at T+X" badge visible in the scrubber — emphasizes time advantage

### 4.6 Analytics Mode *(NEW — fourth tab)*

This is the "we did serious ML" tab. Layout:

```
┌─────────────────────────────────────────────────────────────────────┐
│  MODEL OVERVIEW                                                     │
│  ┌─────────────────┬─────────────────┬─────────────────┐           │
│  │ TEXBAT L1 v1    │ Aissou L2 v1    │ LSTM-AE v1      │           │
│  │ F1: 0.984       │ F1: 0.976       │ F1: 0.935       │           │
│  │ Latency: 3.2 ms │ Latency: 4.1 ms │ Latency: 38 ms  │           │
│  │ [tiny ROC]      │ [tiny ROC]      │ [tiny ROC]      │           │
│  └─────────────────┴─────────────────┴─────────────────┘           │
│                                                                     │
│  COMPARISON                                                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │ Model             | F1   | Precision | Recall | AUC      │      │
│  │ Logistic Reg.     | 0.81 | 0.79      | 0.83   | 0.87     │      │
│  │ Random Forest     | 0.93 | 0.91      | 0.94   | 0.96     │      │
│  │ XGBoost (TEXBAT)  | 0.98 | 0.97      | 0.99   | 0.99     │      │
│  │ Isolation Forest  | 0.85 | 0.78      | 0.92   | 0.91     │      │
│  └──────────────────────────────────────────────────────────┘      │
│                                                                     │
│  FEATURE IMPORTANCE        SHAP (global)         INCIDENTS MAP      │
│  [horizontal bar chart]    [beeswarm]            [pin map heatmap]  │
└─────────────────────────────────────────────────────────────────────┘
```

**Implementation notes:**
- Pull F1 numbers from `/api/health` response (eliminate hardcoded values across codebase)
- Comparison table data: hardcode in `frontend/lib/analytics-data.ts` — these come from team's actual ML training results (Person C from PRD), insert real numbers when available, placeholder until then
- Use `recharts` for charts (it's already in deps)
- Feature importance: horizontal bar chart with shadcn-styled bars, Honeywell red gradient
- SHAP global summary: simulated beeswarm using recharts `Scatter`, OR if too complex, just bar chart of mean |SHAP| per feature
- Incidents map: small Mapbox map (re-use globe code, but no aircraft layer, just pin markers from `/api/incidents` or fallback)

This tab is what makes judges check the "rigor of ML pipeline" boxes. Don't skip.

### 4.7 Voice LLM Audio Hookup

**File:** `lib/audio/voice-alert.ts` (NEW)

```ts
const audio = new Audio();

export async function playVoiceAlert(alertId: string, fallback = true) {
  try {
    audio.src = `${API_BASE}/api/alerts/${alertId}/speak`;
    audio.volume = 0.85;
    // Optional BIP intro — preload from public/sounds/cockpit-bip.mp3
    await playBip();
    await audio.play();
  } catch (e) {
    console.warn('Voice alert failed, falling back to beep', e);
    if (fallback) playBeep();  // existing Web Audio sine waves
  }
}

async function playBip() {
  const bip = new Audio('/sounds/cockpit-bip.mp3');
  bip.volume = 0.6;
  return bip.play().catch(() => {});  // best-effort
}
```

**File:** `frontend/public/sounds/cockpit-bip.mp3` — short 200ms BIP. Source: freesound.org (CC0). If missing, skip silently.

**Integration in `alert-system.tsx`:**
- When CRITICAL alert fires, check `useUIStore().voiceLLMEnabled`
- If enabled: call `playVoiceAlert(tick.id)`
- If disabled or in mock mode: existing beep
- Add toggle in TopBar near audio button: switch between BEEP and VOICE
- Show small "🔊 Generating alert..." toast (sonner) while audio loads, fades when audio starts

### 4.8 Motion Design (Framer Motion) — Where to Apply

Sparingly but consistently. Animations should feel natural, not "I learned Framer Motion yesterday".

| Surface | Animation | Detail |
|---|---|---|
| Mode tabs | layoutId underline | shared element across tabs |
| Cards entering | `initial={{opacity:0, y:8}} animate={{opacity:1, y:0}}` stagger 50ms | on mode switch |
| Score bars | `layout` prop on value div | smooth height/width changes |
| Verdict pill | `whileInView` scale pop on change | quick attention pull |
| Alerts | full-screen flash via `AnimatePresence` | red overlay 500ms |
| Toasts | sonner default | already animated |
| Modal/Sheet | shadcn defaults | already animated |
| Globe camera | Mapbox `flyTo` | not Framer — Mapbox handles |
| Trajectory dash flow | CSS keyframes `dashoffset` | not Framer — CSS perf better |

**Rule:** If an animation runs every tick (60Hz), do NOT use Framer — use CSS or three.js directly. Framer is for state transitions only.

### 4.9 Polish — Skeletons, Empty States, Microinteractions

Replace EVERY "Waiting for first tick..." plain-text with shadcn `Skeleton`:

```tsx
{!tick ? (
  <div className="space-y-3">
    <Skeleton className="h-4 w-24" />
    <Skeleton className="h-32 w-full" />
    <Skeleton className="h-4 w-48" />
  </div>
) : (
  <ActualContent tick={tick} />
)}
```

Empty states (no aircraft, no alerts) — proper empty state component:
```
┌─────────────────────────────┐
│                             │
│       [📡 idle radar]       │
│                             │
│     No aircraft in view     │
│   Switch scenario to start  │
│                             │
└─────────────────────────────┘
```

Microinteractions:
- All buttons: scale 0.97 on press (CSS `active:scale-[0.97] transition`)
- Hover on interactive cards: subtle border glow honeywell-color, 200ms
- Number changes (latency, scores): use `<NumberFlow>` from shadcn or `framer-motion` `animate` between numbers — looks like a slot machine, very satisfying
- Selected aircraft on globe: outer ring pulses (CSS animation 1.5s loop)

---

## 5. File Structure (target after upgrade)

```
frontend/
├── app/
│   ├── layout.tsx                    (minor: add fonts, metadata)
│   ├── page.tsx                      (no change)
│   └── globals.css                   (add animations: pulse, dash-flow, ring-pulse)
├── components/
│   ├── dashboard-client.tsx          (REFACTOR: use Zustand, add Analytics mode)
│   ├── top-bar.tsx                   (REWRITE with shadcn)
│   ├── onboard/
│   │   ├── onboard-monitor.tsx       (REFACTOR with shadcn cards)
│   │   ├── score-bar.tsx             (KEEP, add layout animation)
│   │   ├── score-cell.tsx            (KEEP)
│   │   ├── top-reasons.tsx           (REFACTOR with shadcn)
│   │   └── verdicts-mini-strip.tsx   (NEW)
│   ├── live-globe/
│   │   ├── live-globe.tsx            (REWRITE — use new Mapbox)
│   │   ├── mapbox-globe.tsx          (NEW — main 3D map)
│   │   ├── aircraft-layer.ts         (NEW — three.js custom layer)
│   │   ├── trajectory-source.ts      (NEW — line-gradient trails)
│   │   ├── spoofing-arc-layer.ts     (NEW — divergence visualization)
│   │   ├── camera-controls.tsx       (NEW — free/follow/cinematic toggle)
│   │   └── aircraft-list-panel.tsx   (REFACTOR with shadcn ScrollArea)
│   ├── replay/
│   │   ├── replay-view.tsx           (REFACTOR — load incidents)
│   │   ├── replay-onboard.tsx        (KEEP)
│   │   ├── replay-globe.tsx          (KEEP — Leaflet for now, optional Mapbox upgrade later)
│   │   ├── replay-map.tsx            (KEEP)
│   │   ├── timeline-scrubber.tsx     (AUGMENT — annotation markers)
│   │   ├── incident-library.tsx      (NEW — Sheet drawer)
│   │   └── incident-narrative.tsx    (NEW — side panel)
│   ├── analytics/                    (NEW — entire folder)
│   │   ├── analytics-view.tsx
│   │   ├── model-overview-cards.tsx
│   │   ├── comparison-table.tsx
│   │   ├── feature-importance-chart.tsx
│   │   ├── shap-summary-chart.tsx
│   │   └── incidents-map.tsx
│   ├── alerts/
│   │   ├── alert-system.tsx          (REFACTOR — voice LLM, sonner)
│   │   └── alert-flash.tsx           (NEW — full-screen Framer flash)
│   ├── shared/
│   │   ├── verdict-pill.tsx          (REFACTOR with shadcn Badge variants)
│   │   ├── number-flow.tsx           (NEW — animated number)
│   │   ├── empty-state.tsx           (NEW)
│   │   └── status-pill.tsx           (REFACTOR)
│   ├── ui/                           (shadcn generates these)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── dialog.tsx
│   │   ├── sheet.tsx
│   │   ├── tabs.tsx
│   │   ├── badge.tsx
│   │   ├── tooltip.tsx
│   │   ├── sonner.tsx
│   │   ├── skeleton.tsx
│   │   ├── select.tsx
│   │   ├── slider.tsx
│   │   ├── switch.tsx
│   │   ├── separator.tsx
│   │   ├── scroll-area.tsx
│   │   ├── popover.tsx
│   │   └── toggle-group.tsx
│   └── explain-modal.tsx             (REFACTOR with shadcn Dialog, keep SHAP logic)
├── lib/
│   ├── stores/
│   │   └── ui-store.ts               (NEW — Zustand)
│   ├── design-tokens.ts              (NEW)
│   ├── incidents-fallback.ts         (NEW)
│   ├── analytics-data.ts             (NEW — comparison table data)
│   ├── audio/
│   │   ├── voice-alert.ts            (NEW)
│   │   └── beep.ts                   (EXTRACT existing beep code)
│   ├── mapbox/
│   │   ├── globe-config.ts           (NEW)
│   │   └── geo-utils.ts              (NEW — great-circle interpolation)
│   ├── types.ts                      (EXTEND — add Mode='analytics', Incident, etc.)
│   ├── ws.ts                         (KEEP)
│   ├── api.ts                        (KEEP, add getIncidents, getAnalytics)
│   ├── mock-feed.ts                  (KEEP)
│   └── utils.ts                      (NEW — cn() helper from shadcn)
└── public/
    ├── models/
    │   └── aircraft.glb              (NEW — download CC0 GLTF)
    └── sounds/
        └── cockpit-bip.mp3           (NEW — optional BIP intro)
```

---

## 6. Implementation Order (suggested 6–10h)

### Phase 1 — Foundation (1.5h)

1. Install deps: `mapbox-gl`, `three`, `framer-motion`, `sonner`, `zustand`, `clsx`, `tailwind-merge`, `class-variance-authority`, `d3-geo`
2. Run `npx shadcn@latest init` — choose neutral palette, dark mode default
3. Add shadcn components: `button card dialog sheet tabs badge tooltip sonner separator scroll-area skeleton popover select slider switch toggle-group`
4. Create `lib/design-tokens.ts`, `lib/utils.ts` with `cn()`
5. Create `lib/stores/ui-store.ts` (empty store, just shape)
6. Migrate dashboard state to Zustand step-by-step (mode, scenarioId first; rest later)
7. Add `NEXT_PUBLIC_MAPBOX_TOKEN` to `.env.local` and `.env.example`
8. Verify build passes, smoke-test existing pages

**Checkpoint:** App builds, all existing functionality works, shadcn primitives render in any one place.

### Phase 2 — Top Bar + Onboard refactor (1.5h)

1. Rewrite `top-bar.tsx` with shadcn `Tabs`, `Select`, `Badge`, `Button`
2. Add 4th mode "Analytics" tab (renders placeholder for now)
3. Refactor `onboard-monitor.tsx`: wrap sections in `Card`, replace pills with `Badge` variants
4. Add `verdicts-mini-strip.tsx` component
5. Replace plain-text "Waiting..." with `Skeleton`
6. Add Framer Motion entrance animations for cards

**Checkpoint:** Onboard mode looks measurably more polished than before; design system consistent.

### Phase 3 — Mapbox 3D Globe (3h — biggest chunk)

1. Create `mapbox-globe.tsx` shell with token check, error boundary
2. Initialize map with globe projection, fog, terrain, sky layer
3. Add `aircraft-layer.ts` — three.js custom layer, GLTF load, instance management
4. Source/place a CC0 aircraft GLB at `public/models/aircraft.glb`
5. Wire WebSocket aircraft updates to `aircraftLayer.updateAircraft()` calls (throttle to 30Hz)
6. Add trajectory ribbons via `line-gradient` source
7. Add spoofing divergence indicator for CRITICAL aircraft
8. Add camera controls: free / follow / cinematic
9. Implement cinematic auto-trigger on first CRIT
10. Replace `globe-map.tsx` usage in live mode with `mapbox-globe.tsx` (keep Leaflet for replay temporarily)
11. Performance pass: cap 50 visible, throttle updates, profile

**Checkpoint:** Aircraft fly smoothly on 3D globe with rotation, ribbons trail behind, CRIT triggers cinematic camera.

### Phase 4 — Replay narrative + Incident library (1.5h)

1. Create `incidents-fallback.ts` with 3 named incidents
2. Create `incident-library.tsx` Sheet drawer
3. Create `incident-narrative.tsx` side panel with timeline
4. Augment `timeline-scrubber.tsx` with annotation markers
5. Wire incident → scenario mapping; loading an incident loads the corresponding scenario CSV
6. Add `/api/incidents` fetch with fallback to hardcoded

**Checkpoint:** Replay mode now has a left-side scenario list AND right-side incident library with story scaffolding.

### Phase 5 — Analytics tab (1.5h)

1. Create `analytics/` folder structure
2. `model-overview-cards.tsx` — 3 cards pulling from `/api/health`
3. `comparison-table.tsx` — static data from `analytics-data.ts`, shadcn `Table`
4. `feature-importance-chart.tsx` — recharts horizontal bar
5. `shap-summary-chart.tsx` — recharts (bar of mean |SHAP|)
6. `incidents-map.tsx` — minimal Mapbox map with pins
7. Wire into mode switching

**Checkpoint:** Analytics tab renders with real numbers from backend health endpoint, charts visible.

### Phase 6 — Voice LLM + polish (1h)

1. `lib/audio/voice-alert.ts` with playback + fallback
2. Integrate into `alert-system.tsx`
3. Add toggle in TopBar
4. Set up `sonner` `<Toaster />` in `layout.tsx`
5. Replace custom toasts with `toast()` calls
6. Add `<NumberFlow>` to latency badge, score bar values
7. Add hover glow to all interactive cards
8. Final pass on empty states, skeleton consistency

**Checkpoint:** Voice alert plays on CRIT, toasts smooth, numbers animate.

### Phase 7 — Buffer / breakage fixes (0.5–1h)

Reserve for whatever broke, perf issues, demo prep.

---

## 7. Acceptance Tests (manual, walk through these before declaring done)

1. **Cold start:** Open app, all 4 tabs render without console errors, Mapbox globe loads, 3 aircraft visible.
2. **Mode switch:** Click Onboard → Live Globe → Replay → Analytics → Onboard. Each transition < 300ms, no layout jumps, mode underline animates smoothly.
3. **Onboard scenario:** Switch to `texbat_spoof` scenario. ScoreBars animate, sparkline updates, verdict transitions OK→WARN→CRIT trigger flash + sound, Explain modal opens, SHAP bars render.
4. **Live globe:** Switch to `baltic_teleport`. Aircraft GLTF models visible on 3D globe, rotated to heading. Trajectory ribbons fade behind. On first CRIT, camera does cinematic flyTo. Spoofing divergence indicator appears.
5. **Replay incident:** Open Incident Library drawer, select "AZAL Flight 8243". Narrative panel populates with timeline. Scrubber shows annotation markers. Play at 1× — alerts fire at correct ticks.
6. **Analytics:** Tab shows 3 model cards with F1 from /api/health (NOT hardcoded), comparison table with 4 rows, feature importance chart, SHAP chart, incidents map with pins.
7. **Voice toggle:** Switch voice from BEEP to VOICE in TopBar. Trigger CRIT. Toast "Generating alert..." appears, then audio plays. Switch to BEEP, trigger CRIT — beep plays.
8. **Mock mode:** Disconnect backend. Mock badge appears. All scenarios fall back to client-generated ticks. Most features still work; ExplainModal degrades gracefully ("offline mode").
9. **Performance:** Live globe with 50+ aircraft sustains 30+ fps. Mode switches don't leak memory (check DevTools).
10. **Export:** Click Export Report. JSON downloads with run summary.

---

## 8. Risks & Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Mapbox token missing/expired during demo | Med | Banner + fallback to Leaflet 2D map; do not crash |
| GLTF model fails to load | Med | Three.js cone fallback, log warning |
| three.js custom layer conflicts with Mapbox repaint | Med | Strict adherence to `triggerRepaint` pattern from official Mapbox docs example |
| 3D globe fps tanks with 200+ aircraft | High | Cap visible to 50, object pooling, throttle WS updates to 30Hz |
| Next.js 16 breaking changes hit shadcn or framer-motion | Med | All FE work happens in client components, avoid server actions |
| Voice TTS endpoint slow/fails | Med | Fallback to beep, "Generating..." toast manages UX |
| `/api/incidents` not implemented backend-side | High | `incidents-fallback.ts` always available; frontend never assumes backend has data |
| Tailwind v4 + shadcn config conflict | Med | shadcn supports Tailwind v4 as of 2025; verify with `npx shadcn@latest init` warnings |
| Touch/zoom on Mapbox globe annoying for judges | Low | Disable touch zoom in demo, lock to specific bbox per scenario |
| GLTF model has IP/license issues | Low | Use Kenney.nl CC0 pack; document source in `public/models/LICENSE.txt` |

---

## 9. Out of Scope — explicitly do NOT do these

- Don't migrate Replay mode's Leaflet to Mapbox (keep working code)
- Don't refactor the WebSocket hooks
- Don't change EWMA smoothing logic
- Don't touch backend
- Don't add unit tests beyond what exists (we don't have time)
- Don't internationalize (keep Polish strings as-is)
- Don't add user accounts, auth, persistence beyond localStorage UI prefs
- Don't optimize for mobile beyond not-broken
- Don't try to beat XGBoost — this is FE only
- Don't implement attack simulator UI (separate PRD if we add it)

---

## 10. Final Notes for Claude Code

1. **Read existing files before changing them.** Especially `dashboard-client.tsx`, `top-bar.tsx`, `globe-map.tsx`, `alert-system.tsx`, `explain-modal.tsx`, and `lib/types.ts`. The codebase has good conventions; respect them.
2. **Keep mock mode working at every step.** It's the demo safety net.
3. **Commit frequently.** After each Phase, make a commit so we can roll back if needed.
4. **Don't pre-optimize.** Get visual functional, then profile. Mapbox + three.js will surprise you.
5. **Use TypeScript strict.** No `any` unless commented why.
6. **No new console errors.** Keep dev console clean — judges DO check this.
7. **Respect AGENTS.md.** If something contradicts, read AGENTS.md.

Good luck. Make it the prettiest GNSS defense console anyone in the room has ever seen. The judges from Honeywell already build the world's actual cockpit avionics — we owe them a UI that looks like it could ship.

---

*Document v1.0 — for Claude Code execution. Author: hackathon team architect. Date: pre-Kościuszkon 2026.*

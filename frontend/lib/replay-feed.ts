import { WS_BASE } from "./api";
import { buildMockReplay } from "./mock-feed";
import type { ReplayBundle } from "./types";

const TIMEOUT_MS = 30_000;

/**
 * Load the full pre-scored replay bundle for a scenario.
 *
 * Opens a WebSocket to /ws/replay/{onboard|globe}, waits for the single
 * "replay_init" burst message, then closes. Falls back to buildMockReplay
 * if mockMode is true or if the connection fails.
 */
export function loadReplay(
  scenario: string,
  scenarioMode: "onboard" | "live_globe",
  mockMode: boolean,
): Promise<ReplayBundle> {
  if (mockMode) {
    return Promise.resolve(buildMockReplay(scenario));
  }

  return new Promise((resolve, reject) => {
    const endpoint = scenarioMode === "onboard" ? "onboard" : "globe";
    const url = `${WS_BASE}/ws/replay/${endpoint}?scenario=${encodeURIComponent(scenario)}`;
    let ws: WebSocket;
    let timer: ReturnType<typeof setTimeout>;

    try {
      ws = new WebSocket(url);
    } catch {
      resolve(buildMockReplay(scenario));
      return;
    }

    timer = setTimeout(() => {
      ws.close();
      reject(new Error(`replay timeout for ${scenario}`));
    }, TIMEOUT_MS);

    ws.onmessage = (ev) => {
      clearTimeout(timer);
      try {
        const data = JSON.parse(ev.data) as ReplayBundle;
        if (data.kind === "replay_init") {
          resolve(data);
        } else {
          reject(new Error(`unexpected replay message kind: ${(data as { kind: string }).kind}`));
        }
      } catch (e) {
        reject(e);
      } finally {
        ws.close();
      }
    };

    ws.onerror = () => {
      clearTimeout(timer);
      ws.close();
      // Backend unreachable — fall back gracefully.
      resolve(buildMockReplay(scenario));
    };

    ws.onclose = (ev) => {
      if (!ev.wasClean) {
        clearTimeout(timer);
        resolve(buildMockReplay(scenario));
      }
    };
  });
}

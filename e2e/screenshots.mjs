import { chromium } from "playwright";
import fs from "node:fs/promises";

const BASE = process.env.E2E_BASE ?? "http://localhost:3000";
const OUT = "../e2e_screenshots";
await fs.mkdir(OUT, { recursive: true });

const SCENARIOS = [
  { mode: "onboard", id: "normal_waw_gdn",        label: "01_onboard_normal" },
  { mode: "onboard", id: "texbat_spoof",          label: "02_onboard_texbat_spoof" },
  { mode: "onboard", id: "aissou_channel_attack", label: "03_onboard_aissou_channel" },
  { mode: "live_globe", id: "baltic_teleport",    label: "04_globe_baltic_teleport" },
  { mode: "live_globe", id: "smooth_drift_fleet", label: "05_globe_smooth_drift" },
];

const log = (...args) => console.log("[e2e]", ...args);

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 920 } });
const page = await ctx.newPage();

const consoleLines = [];
page.on("console", (msg) => consoleLines.push(`[${msg.type()}] ${msg.text()}`));
page.on("pageerror", (err) => consoleLines.push(`[pageerror] ${err.message}`));

await page.goto(BASE, { waitUntil: "networkidle" });
log("loaded:", BASE);
await page.waitForTimeout(2000);

async function pickMode(mode) {
  const sel = mode === "onboard" ? 'button:has-text("Onboard Monitor")' : 'button:has-text("Live Globe")';
  await page.click(sel);
  await page.waitForTimeout(400);
}

async function pickScenario(id) {
  await page.selectOption("select", id);
  await page.waitForTimeout(2500);
}

for (const s of SCENARIOS) {
  log("scenario:", s.label);
  await pickMode(s.mode);
  await pickScenario(s.id);

  // Wait until callsign / aircraft list populates (real or mock).
  if (s.mode === "onboard") {
    await page.waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="callsign"]');
        return el && el.textContent && !el.textContent.includes("—");
      },
      null,
      { timeout: 8000 },
    ).catch(() => log("  (callsign timeout — capturing anyway)"));
  } else {
    await page.waitForTimeout(3500);
  }

  await page.screenshot({ path: `${OUT}/${s.label}.png`, fullPage: false });
  log("  saved:", `${OUT}/${s.label}.png`);
}

// Demo flow: inject + verdict transition.
log("\nrunning inject demo flow on texbat_spoof");
await pickMode("onboard");
await pickScenario("texbat_spoof");
await page.waitForTimeout(2000);
await page.screenshot({ path: `${OUT}/06_pre_inject.png` });

await page.click('button:has-text("Inject Attack")');
log("injected");
await page.waitForTimeout(6000);
await page.screenshot({ path: `${OUT}/07_post_inject.png` });

// Globe inject as well
log("inject demo on baltic_teleport");
await pickMode("live_globe");
await pickScenario("baltic_teleport");
await page.waitForTimeout(2500);
await page.click('button:has-text("Inject Attack")');
await page.waitForTimeout(8000);
await page.screenshot({ path: `${OUT}/08_globe_post_inject.png` });

// Click first row in aircraft list to verify selection.
const firstRow = page.locator("tbody tr").first();
if (await firstRow.count()) {
  await firstRow.click();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${OUT}/09_globe_selected.png` });
}

// Save console log
await fs.writeFile(`${OUT}/console.log`, consoleLines.join("\n"));

await browser.close();
log("done");

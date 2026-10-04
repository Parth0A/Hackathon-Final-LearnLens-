// Screenshots the LearnLens student Home + Dashboard in light and dark themes
// (desktop + mobile) using headless Chrome over CDP. No external dependencies —
// requires Node >= 22 (global WebSocket/fetch) and local Chrome.
//
// Usage: node screenshots/capture.mjs   (with stub-api.mjs and the Vite dev server running)
import { spawn, execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { writeFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";

const BASE = "http://localhost:3000";
const CDP_PORT = 9444;
const OUT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CHROME_CANDIDATES = [
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function findChrome() {
  return CHROME_CANDIDATES.find((p) => { try { return existsSync(p); } catch { return false; } });
}

async function waitForHttp(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try { const res = await fetch(url); if (res.ok) return; } catch { /* retry */ }
    await sleep(400);
  }
  throw new Error(`timed out waiting for ${url}`);
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  await waitForHttp(BASE, 90000);

  const chromePath = findChrome();
  if (!chromePath) throw new Error("Chrome not found");

  const profileDir = path.join(os.tmpdir(), `learnlens-shot-${Date.now()}`);
  const chrome = spawn(chromePath, [
    "--headless=new",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${profileDir}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--window-size=1440,900",
    "about:blank",
  ], { stdio: "ignore" });

  const cleanup = () => {
    try { execSync(`taskkill /PID ${chrome.pid} /T /F`, { stdio: "ignore" }); } catch { /* already gone */ }
  };
  process.on("exit", cleanup);

  // Wait for the DevTools endpoint, then open a dedicated page target.
  let target = null;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${CDP_PORT}/json/new?${encodeURIComponent("about:blank")}`, { method: "PUT" });
      if (res.ok) target = await res.json();
    } catch { /* chrome not up yet */ }
    if (!target) await sleep(500);
  }
  if (!target) throw new Error("could not create a Chrome page target");

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let seq = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    }
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  await send("Page.enable");
  await send("Runtime.enable");

  const evaluate = async (expression) => {
    const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text || "evaluate failed");
    return r.result.value;
  };

  const waitFor = async (expression, timeoutMs = 45000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try { if (await evaluate(`Boolean(${expression})`)) return; } catch { /* keep polling */ }
      await sleep(300);
    }
    throw new Error(`timed out waiting for: ${expression}`);
  };

  const report = [];
  const log = (line) => { console.log(line); report.push(line); };

  const configs = [
    { theme: "light", form: "desktop", viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false } },
    { theme: "dark", form: "desktop", viewport: { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false } },
    { theme: "light", form: "mobile", viewport: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } },
    { theme: "dark", form: "mobile", viewport: { width: 390, height: 844, deviceScaleFactor: 2, mobile: true } },
  ];

  const FREEZE_ANIMATIONS = `(() => {
    const apply = () => {
      const s = document.createElement('style');
      s.textContent = '*,*::before,*::after{animation-duration:.001s !important;animation-delay:0s !important;transition-duration:.001s !important;transition-delay:0s !important}';
      document.documentElement.appendChild(s);
    };
    if (document.documentElement) apply(); else document.addEventListener('DOMContentLoaded', apply);
  })();`;

  for (const cfg of configs) {
    const scriptId = (await send("Page.addScriptToEvaluateOnNewDocument", {
      source: `try { localStorage.setItem('learnlens-theme', '${cfg.theme}'); } catch (e) {}\n${FREEZE_ANIMATIONS}`,
    })).identifier;

    await send("Emulation.setDeviceMetricsOverride", {
      width: cfg.viewport.width,
      height: cfg.viewport.height,
      deviceScaleFactor: cfg.viewport.deviceScaleFactor,
      mobile: cfg.viewport.mobile,
    });

    // ---- Home ----
    await send("Page.navigate", { url: BASE });
    await waitFor(`document.querySelector('[data-testid="home-launcher"]')`);
    await waitFor(`(document.querySelector('[data-testid="hero-stat-mastery"]')?.querySelectorAll('p').length || 0) >= 2`);
    await evaluate(`document.fonts.ready.then(() => true)`);
    await sleep(700);

    const homeInfo = await evaluate(`(() => {
      const pick = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
      const stats = [...document.querySelectorAll('[data-testid^="hero-stat-"] p:last-child')].map((n) => n.textContent);
      return {
        htmlClass: document.documentElement.className,
        bodyBg: getComputedStyle(document.body).backgroundColor,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pageHeight: document.documentElement.scrollHeight,
        heroBg: pick('[data-testid="home-hero"]', 'backgroundColor'),
        debuggerBg: pick('[data-testid="learning-debugger-card"]', 'backgroundColor'),
        plannerVisible: Boolean(document.querySelector('[data-testid="independent-feature-2"]')),
        debuggerVisible: Boolean(document.querySelector('[data-testid="learning-debugger-card"]')),
        lockedCount: document.querySelectorAll('[data-testid^="locked-feature-"]').length,
        stats: stats.join(' / '),
      };
    })()`);
    log(`\n[${cfg.form}/${cfg.theme}] HOME  html="${homeInfo.htmlClass}" bodyBg=${homeInfo.bodyBg} heroBg=${homeInfo.heroBg} debuggerBg=${homeInfo.debuggerBg}`);
    log(`  overflowX=${homeInfo.overflowX}px pageHeight=${homeInfo.pageHeight}px stats="${homeInfo.stats}" debugger=${homeInfo.debuggerVisible} planner=${homeInfo.plannerVisible} lockedTiles=${homeInfo.lockedCount}`);

    const homeShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(path.join(OUT_DIR, `home-${cfg.form}-${cfg.theme}.png`), Buffer.from(homeShot.data, "base64"));

    // ---- Dashboard ----
    await evaluate(`document.querySelector('[data-testid="available-feature-dashboard"]').click()`);
    await waitFor(`document.querySelector('[data-testid="student-dashboard"]')`);
    await waitFor(`document.querySelector('[data-testid="planned-tasks-card"]')`);
    await waitFor(`document.querySelector('[data-testid="concept-mastery-row-lifo"]')`);
    await evaluate(`document.fonts.ready.then(() => true)`);
    await sleep(700);

    const dashInfo = await evaluate(`(() => {
      const pick = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
      return {
        bodyBg: getComputedStyle(document.body).backgroundColor,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pageHeight: document.documentElement.scrollHeight,
        statusTitle: document.querySelector('[data-testid="dashboard-status-title"]')?.textContent || null,
        focusBg: pick('[data-testid="current-focus-card"]', 'backgroundColor'),
        masteryBg: pick('[data-testid="mastery-overview-card"]', 'backgroundColor'),
        intelligenceHeader: [...document.querySelectorAll('p')].some((p) => p.textContent === 'Learning intelligence'),
        glanceHeader: [...document.querySelectorAll('p')].some((p) => p.textContent === 'Today at a glance'),
        startAssessment: Boolean(document.querySelector('[data-testid="dashboard-start-assessment-button"]')),
      };
    })()`);
    log(`[${cfg.form}/${cfg.theme}] DASH  bodyBg=${dashInfo.bodyBg} focusBg=${dashInfo.focusBg} masteryBg=${dashInfo.masteryBg}`);
    log(`  overflowX=${dashInfo.overflowX}px pageHeight=${dashInfo.pageHeight}px status="${dashInfo.statusTitle}" headers(glance=${dashInfo.glanceHeader}, intelligence=${dashInfo.intelligenceHeader}) startAssessment=${dashInfo.startAssessment}`);

    const dashShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(path.join(OUT_DIR, `dashboard-${cfg.form}-${cfg.theme}.png`), Buffer.from(dashShot.data, "base64"));

    if (cfg.form === "desktop") {
      // ---- Why Am I Stuck? (debugger evidence view) ----
      await evaluate(`document.querySelector('[data-testid="dashboard-review-gap-button"]').click()`);
      await waitFor(`document.querySelector('[data-testid="evidence-drawer"]')`);
      await waitFor(`document.querySelector('[data-testid="evidence-item-attempt_pattern"]')`);
      await evaluate(`document.fonts.ready.then(() => true)`);
      await sleep(700);
      const stuckInfo = await evaluate(`(() => {
        const pick = (sel, prop) => { const el = document.querySelector(sel); return el ? getComputedStyle(el)[prop] : null; };
        return {
          overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          pageHeight: document.documentElement.scrollHeight,
          diagnosisBg: pick('[data-testid="diagnosis-summary-card"]', 'backgroundColor'),
          rootGap: document.querySelector('[data-testid="diagnosed-root-gap"]')?.textContent || null,
          evidenceCount: document.querySelectorAll('[data-testid^="evidence-item-"]').length,
        };
      })()`);
      log(`[${cfg.form}/${cfg.theme}] STUCK overflowX=${stuckInfo.overflowX}px pageHeight=${stuckInfo.pageHeight}px diagnosisBg=${stuckInfo.diagnosisBg} rootGap="${stuckInfo.rootGap}" evidence=${stuckInfo.evidenceCount}`);
      const stuckShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(path.join(OUT_DIR, `stuck-${cfg.form}-${cfg.theme}.png`), Buffer.from(stuckShot.data, "base64"));

      // ---- Assessment (question view with one option selected) ----
      await evaluate(`document.querySelector('[data-testid="return-home-button"]').click()`);
      await waitFor(`document.querySelector('[data-testid="home-launcher"]')`);
      await evaluate(`document.querySelector('[data-testid="available-feature-dashboard"]').click()`);
      await waitFor(`document.querySelector('[data-testid="student-dashboard"]')`);
      await evaluate(`document.querySelector('[data-testid="dashboard-start-assessment-button"]').click()`);
      await waitFor(`document.querySelector('[data-testid="assessment-view"]')`);
      await waitFor(`document.querySelectorAll('[data-testid^="assessment-option-"]').length >= 4`);
      await evaluate(`document.querySelector('[data-testid^="assessment-option-"]').click()`);
      await evaluate(`document.fonts.ready.then(() => true)`);
      await sleep(700);
      const quizInfo = await evaluate(`(() => ({
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        pageHeight: document.documentElement.scrollHeight,
        options: document.querySelectorAll('[data-testid^="assessment-option-"]').length,
        selected: document.querySelectorAll('[data-testid^="assessment-option-"] input:checked').length,
        prompt: (document.querySelector('[data-testid="question-prompt"]')?.textContent || '').slice(0, 46),
      }))()`);
      log(`[${cfg.form}/${cfg.theme}] QUIZ overflowX=${quizInfo.overflowX}px pageHeight=${quizInfo.pageHeight}px options=${quizInfo.options} selected=${quizInfo.selected} prompt="${quizInfo.prompt}"`);
      const quizShot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(path.join(OUT_DIR, `assessment-${cfg.form}-${cfg.theme}.png`), Buffer.from(quizShot.data, "base64"));
    }

    await send("Page.removeScriptToEvaluateOnNewDocument", { identifier: scriptId });
  }

  await writeFile(path.join(OUT_DIR, "report.txt"), report.join("\n") + "\n", "utf8");
  ws.close();
  cleanup();
  console.log("\nScreenshots written to", OUT_DIR);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });

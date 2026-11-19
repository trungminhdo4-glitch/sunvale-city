// Renders Sunvale's screenshot scenes in headless Microsoft Edge over the Chrome DevTools Protocol and saves them
// as JPEGs (1280x720, at most 256 KiB each) into screenshots/. Real renders of the game's own code, no editing.
//
// usage: node serve.ts   (in another shell)   then   node tools/capture-shots.mjs [name ...]
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const EDGE = process.env.EDGE_PATH ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const BASE = process.env.GAME_URL ?? 'http://localhost:8080/';
const PORT = 9333;
const MAX_BYTES = 256 * 1024;
const only = process.argv.slice(2);
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8')).filter((s) => !only.length || only.some((o) => s.name.includes(o)));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const profile = join(tmpdir(), `sunvale-edge-${process.pid}`);
mkdirSync(profile, { recursive: true });
const tidy = () => { try { rmSync(profile, { recursive: true, force: true }); } catch { /* Edge may still hold a lock; the OS temp folder cleans up */ } };

const edge = spawn(EDGE, ['--headless=new', `--remote-debugging-port=${PORT}`, `--user-data-dir=${profile}`, '--window-size=1280,720',
  '--hide-scrollbars', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--no-first-run', '--mute-audio', 'about:blank'], { stdio: 'ignore' });

async function browserSocket() {
  for (let k = 0; k < 60; k++) {
    try { const r = await fetch(`http://127.0.0.1:${PORT}/json/version`); return (await r.json()).webSocketDebuggerUrl; } catch { await sleep(250); }
  }
  throw new Error('Edge did not open its DevTools port');
}

class Cdp {
  constructor(url) { this.ws = new WebSocket(url); this.id = 0; this.waiting = new Map(); }
  async open() {
    await new Promise((res, rej) => { this.ws.onopen = res; this.ws.onerror = rej; });
    this.ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.id && this.waiting.has(msg.id)) {
        const { res, rej } = this.waiting.get(msg.id);
        this.waiting.delete(msg.id);
        if (msg.error) rej(new Error(msg.error.message)); else res(msg.result);
      }
    };
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, sessionId }));
    return new Promise((res, rej) => this.waiting.set(id, { res, rej }));
  }
}

async function capture(cdp, shot) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  await S('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  await S('Page.enable');
  await S('Page.navigate', { url: BASE + shot.query });
  const t0 = Date.now();
  for (;;) {
    const r = await S('Runtime.evaluate', { expression: 'JSON.stringify({ ok: window.__shotReady === true, err: window.__shotError ?? null })', returnByValue: true });
    const v = JSON.parse(r.result.value ?? '{}');
    if (v.err) throw new Error(`${shot.name}: ${v.err}`);
    if (v.ok) break;
    if (Date.now() - t0 > 180000) throw new Error(`${shot.name}: timed out`);
    await sleep(400);
  }
  await sleep(300);
  let quality = 90, data;
  for (;;) {
    const r = await S('Page.captureScreenshot', { format: 'jpeg', quality });
    data = Buffer.from(r.data, 'base64');
    if (data.length <= MAX_BYTES || quality <= 40) break;
    quality -= 4;
  }
  writeFileSync(join(root, 'screenshots', shot.name), data);
  console.log(`${shot.name}: ${data.length} bytes at quality ${quality} in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  await cdp.send('Target.closeTarget', { targetId });
}

try {
  const cdp = new Cdp(await browserSocket());
  await cdp.open();
  mkdirSync(join(root, 'screenshots'), { recursive: true });
  for (const s of shots) await capture(cdp, s);
} finally {
  edge.kill();
  await sleep(1500);
  tidy();
}

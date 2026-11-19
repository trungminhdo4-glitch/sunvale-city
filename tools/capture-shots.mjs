// Captures the screenshots listed in shots.json from the running game with headless Edge/Chrome
// over the DevTools protocol. No dependencies: Node 22+ (global fetch and WebSocket).
//
//   node serve.ts --port 8093            (in another shell)
//   node tools/capture-shots.mjs --base http://localhost:8093 --profile <dir outside the repo>
//
// Each shot is a real render of game/ at 1280x720, saved as JPEG under screenshots/ and kept
// under the 256 KiB limit by lowering the JPEG quality when needed.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const args = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? args[i + 1] : def; };
const base = opt('base', 'http://localhost:8093');
const profile = opt('profile', null);
const browser = opt('browser', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe');
const port = Number(opt('port', '9333'));
const only = opt('only', null);
const MAX_BYTES = 256 * 1024;

if (!profile) { console.error('--profile <dir> is required (a browser profile folder outside the repository)'); process.exit(2); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function cdpTarget() {
  for (let k = 0; k < 60; k++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch { /* browser still starting */ }
    await sleep(250);
  }
  throw new Error('browser did not open a debugging port');
}

function connect(url) {
  const ws = new WebSocket(url);
  let id = 0;
  const waiting = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && waiting.has(msg.id)) {
      const { resolve, reject } = waiting.get(msg.id);
      waiting.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result);
    }
  };
  const ready = new Promise((r) => { ws.onopen = r; });
  return {
    ready,
    send(method, params = {}) {
      const n = ++id;
      ws.send(JSON.stringify({ id: n, method, params }));
      return new Promise((resolve, reject) => waiting.set(n, { resolve, reject }));
    },
    close() { ws.close(); },
  };
}

async function main() {
  const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
  const proc = spawn(browser, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--window-size=1280,720', '--hide-scrollbars', '--mute-audio', '--no-first-run',
    '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', 'about:blank',
  ], { stdio: 'ignore' });
  try {
    const cdp = connect(await cdpTarget());
    await cdp.ready;
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    mkdirSync(join(root, 'screenshots'), { recursive: true });
    for (const shot of shots) {
      if (only && shot.name !== only) continue;
      await cdp.send('Page.navigate', { url: base + '/' + shot.query });
      let ready = false;
      for (let k = 0; k < 240 && !ready; k++) {
        await sleep(250);
        const r = await cdp.send('Runtime.evaluate', { expression: 'window.__shotReady === true' }).catch(() => null);
        ready = r?.result?.value === true;
      }
      if (!ready) throw new Error(`${shot.name}: scene never became ready`);
      await sleep(900);
      let quality = 86, data;
      do {
        const r = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality });
        data = Buffer.from(r.data, 'base64');
        quality -= 6;
      } while (data.length > MAX_BYTES && quality > 30);
      writeFileSync(join(root, 'screenshots', shot.name), data);
      console.log(`${shot.name}: ${data.length} bytes, quality ${quality + 6}`);
    }
    cdp.send('Browser.close').catch(() => {});
    cdp.close();
  } finally {
    await sleep(500);
    proc.kill();
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });

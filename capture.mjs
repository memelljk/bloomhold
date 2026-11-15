// Capture the four screenshots in shots.json from the real running game.
// Boots serve.ts, drives Chrome for Testing over CDP (Node's built-in
// WebSocket), waits for each ?shot= scene to flag window.__shotReady,
// grabs a PNG, and converts it to a capped JPEG with PIL.
// Usage: node capture.mjs
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const here = fileURLToPath(new URL('.', import.meta.url));
const CHROME = process.env.HOME +
  '/workspace/boltbook/browsers/chrome/linux-156.0.8078.80/chrome-linux64/chrome';
const PORT = 8123;
const CDP = 9333;
const shots = JSON.parse(readFileSync(join(here, 'shots.json'), 'utf8'));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn, timeoutMs, label) {
  const t0 = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() - t0 > timeoutMs) throw new Error('timeout: ' + label);
    await sleep(200);
  }
}

const server = spawn('node', ['serve.ts', '--port', String(PORT)], {
  cwd: here, stdio: 'ignore',
});
const chrome = spawn(CHROME, [
  '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
  '--window-size=1280,800', '--force-device-scale-factor=1',
  '--user-data-dir=/tmp/bloom-chrome-profile', '--no-first-run',
  '--disable-extensions', '--remote-debugging-port=' + CDP, 'about:blank',
], { stdio: 'ignore' });

let ws;
let msgId = 0;
const pending = new Map();
const consoleIssues = [];

function send(method, params = {}, sessionId) {
  const id = ++msgId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
}

try {
  const version = await waitFor(async () => {
    try {
      const r = await fetch('http://127.0.0.1:' + CDP + '/json/version');
      return r.ok ? await r.json() : null;
    } catch { return null; }
  }, 20000, 'chrome cdp');
  ws = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id);
      pending.delete(m.id);
      if (m.error) p.reject(new Error(m.method + ': ' + JSON.stringify(m.error)));
      else p.resolve(m.result);
    } else if (m.method === 'Runtime.consoleAPICalled') {
      const type = m.params.type;
      if (type === 'error' || type === 'warning') {
        consoleIssues.push(type + ': ' + m.params.args.map((a) => a.value || a.description || '').join(' '));
      }
    } else if (m.method === 'Log.entryAdded') {
      const e = m.params.entry;
      if (e.level === 'error') consoleIssues.push('log ' + e.source + ': ' + e.text);
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleIssues.push('exception: ' + (m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text));
    }
  };

  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  // Force the exact game viewport so frames are true 1280x800, not the
  // headless window's shorter default (which squashes the canvas).
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 800, deviceScaleFactor: 1, mobile: false,
  }, sessionId);

  mkdirSync(join(here, 'screenshots'), { recursive: true });
  const results = [];
  for (const shot of shots) {
    const url = 'http://127.0.0.1:' + PORT + '/' + shot.query;
    await send('Page.navigate', { url }, sessionId);
    await waitFor(async () => {
      const r = await send('Runtime.evaluate', {
        expression: 'window.__shotReady === true', returnByValue: true,
      }, sessionId);
      return r.result && r.result.value === true;
    }, 20000, 'shotReady ' + shot.name);
    await sleep(400); // let the frame paint
    const shotRes = await send('Page.captureScreenshot', {
      format: 'png', fromSurface: true,
    }, sessionId);
    const pngPath = '/tmp/bloom_' + shot.name.replace('.jpg', '') + '.png';
    writeFileSync(pngPath, Buffer.from(shotRes.data, 'base64'));
    const outPath = join(here, 'screenshots', shot.name);
    execFileSync('python3', ['-c', `
from PIL import Image
import sys
im = Image.open(sys.argv[1]).convert('RGB')
print('dims', im.size)
q = 76
while True:
    im.save(sys.argv[2], 'JPEG', quality=q)
    import os
    size = os.path.getsize(sys.argv[2])
    if size <= 250000 or q <= 60:
        print('jpeg bytes', size, 'quality', q)
        break
    q -= 6
`, pngPath, outPath], { stdio: 'inherit' });
    results.push(shot.name);
  }

  // Plain play-mode boot: no ?shot — the loop must run clean.
  await send('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/' }, sessionId);
  await sleep(2500);
  const boot = await send('Runtime.evaluate', {
    expression: '!!document.getElementById("game")', returnByValue: true,
  }, sessionId);
  console.log('play-mode canvas present:', boot.result.value);
  console.log('captured:', results.join(', '));
  console.log('console issues:', consoleIssues.length ? consoleIssues : 'NONE');
} finally {
  try { ws && ws.close(); } catch {}
  chrome.kill('SIGKILL');
  server.kill('SIGKILL');
}

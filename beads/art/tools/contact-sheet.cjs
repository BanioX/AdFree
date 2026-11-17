// Rendert alle Perlenbild-Muster als Kontaktbogen-PNGs (Playwright, Chromium).
//
//   node beads/art/tools/contact-sheet.cjs                 # alle, je 6 pro Bild + Gesamtübersicht
//   node beads/art/tools/contact-sheet.cjs --only fox,owl  # nur diese (gross)
//   node beads/art/tools/contact-sheet.cjs --flat          # flache Pixel statt Perlen
//   OUT=/pfad node beads/art/tools/contact-sheet.cjs       # Ausgabeordner (Standard: tools/out)
//
// Startet selbst einen statischen Server (Port 8107) im Repo-Wurzelverzeichnis und beendet ihn wieder.

const { chromium } = require('playwright');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');

const PORT = 8107;
const root = path.resolve(__dirname, '../../..');
const out = process.env.OUT || path.join(__dirname, 'out');
const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
const flat = args.includes('--flat');
const only = opt('--only');
const chunk = +(opt('--chunk') || 6);
const src = opt('--src');
const box = opt('--box');

function waitForServer(url, tries = 50) {
  return new Promise((resolve, reject) => {
    const attempt = (n) => {
      http.get(url, (res) => { res.resume(); resolve(); }).on('error', () => {
        if (n <= 0) reject(new Error('Server startet nicht'));
        else setTimeout(() => attempt(n - 1), 100);
      });
    };
    attempt(tries);
  });
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: root, stdio: 'ignore' });
  let browser;
  const errors = [];
  try {
    await waitForServer(`http://127.0.0.1:${PORT}/`);
    browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 1 });
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const base = `http://127.0.0.1:${PORT}/beads/art/tools/preview.html`;
    const shoot = async (query, file) => {
      await page.goto(`${base}?${query}${flat ? '&flat=1' : ''}${src ? `&src=${src}` : ''}`);
      await page.waitForSelector('body[data-ready]');
      if ((await page.getAttribute('body', 'data-ready')) === 'error') errors.push(await page.textContent('#sheet'));
      const f = path.join(out, file);
      await page.screenshot({ path: f, fullPage: true });
      console.log(f);
    };
    if (src && !only) {
      await shoot(`box=${box || 360}&cols=${opt('--cols') || 4}`, `${src}${flat ? '-flat' : ''}.png`);
    } else if (only) {
      await shoot(`only=${only}&box=${box || 640}&cols=${opt('--cols') || 2}`, `only-${only.replace(/,/g, '_').slice(0, 60)}${flat ? '-flat' : ''}.png`);
    } else {
      const n = await page.goto(`${base}?to=0`).then(() => page.waitForSelector('body[data-ready]'))
        .then(() => page.evaluate(() => import('../index.js').then((m) => m.patterns.length)));
      for (let i = 0; i < n; i += chunk) {
        const a = String(i + 1).padStart(2, '0'), b = String(Math.min(n, i + chunk)).padStart(2, '0');
        await shoot(`from=${i}&to=${i + chunk}&box=420&cols=3`, `sheet-${a}-${b}${flat ? '-flat' : ''}.png`);
      }
      await shoot('box=200&cols=6', `overview${flat ? '-flat' : ''}.png`);
    }
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
  if (errors.length) { console.error('Fehler:\n' + errors.join('\n')); process.exit(1); }
})().catch((e) => { console.error(e); process.exit(1); });

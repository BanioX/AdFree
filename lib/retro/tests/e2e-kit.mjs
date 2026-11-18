import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

function loadChromium() {
  const attempts = [
    () => createRequire(import.meta.url)('playwright'),
    () => createRequire('/tmp/pw/package.json')('playwright-core'),
  ];
  for (const load of attempts) {
    try { return load().chromium; } catch { /* nächster Ort */ }
  }
  throw new Error('playwright fehlt');
}
const chromium = loadChromium();

export async function runRetroE2E({ id, port }) {
  const base = process.env.BASE || `http://127.0.0.1:${port}/${id}/`;
  const out = `/tmp/retro-e2e/${id}/`;
  mkdirSync(out, { recursive: true });
  const errors = [];
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'de-CH',
  });
  await page.addInitScript((game) => {
    localStorage.setItem('spielpause.tutorial.' + game, 'true');
    localStorage.setItem('spielpause.lang', '"de"');
  }, id);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(base);
  await page.waitForSelector('.gm-primary');
  await page.screenshot({ path: out + '01-menu.png' });
  const title = await page.locator('.gm-title').innerText();
  assert.ok(title.length > 1, title);
  await page.locator('.gm-primary').tap();
  await page.waitForSelector('canvas');
  await page.waitForTimeout(400);
  await page.screenshot({ path: out + '02-play.png' });
  const fit = await page.evaluate(() => {
    const c = document.querySelector('canvas').getBoundingClientRect();
    const app = document.querySelector('.app').getBoundingClientRect();
    return {
      bottom: c.bottom, h: innerHeight, w: c.width, iw: innerWidth,
      scroll: document.documentElement.scrollHeight <= innerHeight + 2,
      appH: app.height,
    };
  });
  assert.ok(fit.bottom <= fit.h + 1, JSON.stringify(fit));
  assert.ok(fit.w <= fit.iw + 1, JSON.stringify(fit));
  assert.equal(fit.scroll, true);
  const before = await page.evaluate(() => window.__sp.player());
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    const x = r.left + r.width * 0.25;
    const y = r.top + r.height * 0.75;
    const ev = (type, cx, cy) => c.dispatchEvent(new PointerEvent(type, {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true,
      clientX: cx, clientY: cy, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
    }));
    ev('pointerdown', x, y);
    ev('pointermove', r.left + r.width * 0.8, y);
  });
  await page.waitForTimeout(120);
  const mid = await page.evaluate(() => window.__sp.player());
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    c.dispatchEvent(new PointerEvent('pointercancel', {
      bubbles: true, cancelable: true, pointerId: 7, pointerType: 'touch', isPrimary: true, button: 0,
    }));
  });
  await page.waitForTimeout(80);
  const after = await page.evaluate(() => window.__sp.player());
  assert.ok(Math.abs(mid.x - before.x) > 4, JSON.stringify({ before, mid }));
  assert.ok(Math.abs(after.x - mid.x) < 25, JSON.stringify({ mid, after }));
  const touch = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const r = c.getBoundingClientRect();
    return { x: r.left + r.width * 0.62, y: r.top + r.height * 0.7 };
  });
  const client = await page.context().newCDPSession(page);
  await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touch.x, y: touch.y, id: 1 }] });
  await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touch.x - 40, y: touch.y - 20, id: 1 }] });
  await page.waitForTimeout(80);
  await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(200);
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const ctx = c.getContext('2d');
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 64) if (d[i] + d[i + 1] + d[i + 2] > 40) n++;
    return { n, boss: window.__sp.boss(), lives: window.__sp.player().lives };
  });
  assert.ok(painted.n > 80, JSON.stringify(painted));
  assert.ok(painted.boss && painted.boss.name, JSON.stringify(painted));
  await page.screenshot({ path: out + '03-touch.png' });

  const en = await browser.newPage({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, locale: 'en-US' });
  await en.addInitScript((game) => {
    localStorage.setItem('spielpause.tutorial.' + game, 'true');
    localStorage.setItem('spielpause.lang', '"en"');
  }, id);
  const enErrors = [];
  en.on('pageerror', (e) => enErrors.push(e.message));
  await en.goto(base);
  await en.waitForSelector('.gm-title');
  const enTitle = await en.locator('.gm-title').innerText();
  const deTitle = title;
  assert.notEqual(enTitle, deTitle);
  assert.ok(!/ä|ö|ü|ß/.test(await en.locator('.gm-tagline').innerText()));
  await en.close();

  assert.deepEqual(errors, [], errors.join('\n'));
  assert.deepEqual(enErrors, []);
  await browser.close();
  console.log(id, 'e2e ok', painted.boss.name);
}

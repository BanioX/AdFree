// Erzeugt die PNG-App-Icons aus tools/icon.svg mit Playwright/Chromium.
//   node tools/make-icons.mjs
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const svg = await readFile(path.join(root, 'tools/icon.svg'), 'utf8');

const targets = [
  { file: 'icons/apple-touch-icon.png', size: 180, pad: 0 },
  { file: 'icons/icon-192.png', size: 192, pad: 0 },
  { file: 'icons/icon-512.png', size: 512, pad: 0 },
  // Maskable: Motiv kleiner, damit es in der Safe-Zone (80 %) liegt.
  { file: 'icons/icon-512-maskable.png', size: 512, pad: 0.12 },
  { file: 'icons/favicon-32.png', size: 32, pad: 0 },
];

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  const off = Math.round((t.size - inner) / 2);
  const html = `<!doctype html><html><body style="margin:0;background:#f2638f">
    <div style="position:absolute;left:${off}px;top:${off}px;width:${inner}px;height:${inner}px">
      ${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}
    </div></body></html>`;
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(html);
  await page.screenshot({ path: path.join(root, t.file), clip: { x: 0, y: 0, width: t.size, height: t.size } });
  console.log('wrote', t.file);
}
await browser.close();

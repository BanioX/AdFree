#!/usr/bin/env node
// Erzeugt synthetische, fotoähnliche Testbilder (Verläufe, weiche Formen, Rauschen, Unschärfe)
// für die Foto-Umwandlung. Die Bilder landen ausserhalb des Repos bzw. im ignorierten out/-Ordner.
//
//   node paint/gen/tests/make-test-images.mjs [zielordner]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(process.argv[2] || path.join(HERE, 'out', 'img'));
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');

const images = await page.evaluate(async () => {
  // deterministischer Zufall
  let s = 12345;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const R = (a, b) => a + (b - a) * rnd();

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  function noise(ctx, w, h, amt) {
    const d = ctx.getImageData(0, 0, w, h);
    for (let i = 0; i < d.data.length; i += 4) {
      const n = (rnd() - 0.5) * amt;
      d.data[i] += n; d.data[i + 1] += n; d.data[i + 2] += n;
    }
    ctx.putImageData(d, 0, 0);
  }
  // Fraktale Struktur (wie Laub, Stoff, Haut): mehrere hochskalierte Zufallsraster überlagert
  function texture(c, amp) {
    const x = c.getContext('2d');
    for (const div of [96, 48, 24, 12, 6]) {
      const tw = Math.max(2, Math.round(c.width / div)), th = Math.max(2, Math.round(c.height / div));
      const t = canvas(tw, th), tx = t.getContext('2d');
      const d = tx.createImageData(tw, th);
      for (let i = 0; i < d.data.length; i += 4) { const v = rnd() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = 255; }
      tx.putImageData(d, 0, 0);
      x.save();
      x.globalCompositeOperation = 'overlay';
      x.globalAlpha = amp * (div < 20 ? 0.6 : 1);
      x.imageSmoothingEnabled = true;
      x.drawImage(t, 0, 0, c.width, c.height);
      x.restore();
    }
    return c;
  }
  function blurCopy(c, px) {
    const o = canvas(c.width, c.height);
    const x = o.getContext('2d');
    x.filter = `blur(${px}px)`;
    x.drawImage(c, 0, 0);
    return o;
  }

  function landscape(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h * 0.6);
    g.addColorStop(0, '#3b6fb6'); g.addColorStop(0.6, '#9cc6ea'); g.addColorStop(1, '#f6d9b0');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    const sg = x.createRadialGradient(w * 0.7, h * 0.3, 0, w * 0.7, h * 0.3, w * 0.25);
    sg.addColorStop(0, 'rgba(255,250,220,1)'); sg.addColorStop(0.15, 'rgba(255,240,200,0.9)'); sg.addColorStop(1, 'rgba(255,220,180,0)');
    x.fillStyle = sg; x.fillRect(0, 0, w, h);
    // Wolken
    for (let i = 0; i < 14; i++) {
      x.fillStyle = `rgba(255,255,255,${R(0.25, 0.6)})`;
      x.beginPath(); x.ellipse(R(0, w), R(0.05, 0.35) * h, R(0.05, 0.14) * w, R(0.02, 0.05) * h, 0, 0, 7); x.fill();
    }
    // Berge
    const layers = [['#6f7fa8', 0.42], ['#4f6488', 0.5], ['#3b5a4a', 0.58]];
    for (const [col, base] of layers) {
      x.fillStyle = col; x.beginPath(); x.moveTo(0, h);
      let y = base * h;
      for (let px = 0; px <= w; px += w / 40) { y += R(-0.04, 0.04) * h; y = Math.max(base * h - 0.15 * h, Math.min(base * h + 0.05 * h, y)); x.lineTo(px, y); }
      x.lineTo(w, h); x.closePath(); x.fill();
      // Schnee
      if (col === '#6f7fa8') { x.fillStyle = 'rgba(255,255,255,0.55)'; x.fillRect(0, (base - 0.12) * h, w, 0.04 * h); }
    }
    // See
    const lg = x.createLinearGradient(0, h * 0.64, 0, h);
    lg.addColorStop(0, '#7fa8c9'); lg.addColorStop(1, '#2d5a7c');
    x.fillStyle = lg; x.fillRect(0, h * 0.64, w, h * 0.22);
    // Wiese + Bäume
    const gg = x.createLinearGradient(0, h * 0.82, 0, h);
    gg.addColorStop(0, '#6aa84f'); gg.addColorStop(1, '#2f6b2f');
    x.fillStyle = gg; x.beginPath(); x.moveTo(0, h * 0.86); x.quadraticCurveTo(w * 0.5, h * 0.8, w, h * 0.88); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    for (let i = 0; i < 9; i++) {
      const tx = R(0.02, 0.35) * w, ty = R(0.8, 0.9) * h, th = R(0.12, 0.22) * h;
      x.fillStyle = '#1f4a2a'; x.beginPath(); x.moveTo(tx, ty - th); x.lineTo(tx - th * 0.22, ty); x.lineTo(tx + th * 0.22, ty); x.fill();
    }
    texture(c, 0.22);
    const b = blurCopy(c, Math.max(1, w / 500));
    noise(b.getContext('2d'), w, h, 14);
    return b;
  }

  function face(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, w, h);
    bg.addColorStop(0, '#2f4f6f'); bg.addColorStop(1, '#9fb7a0');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 25; i++) { // Bokeh
      x.fillStyle = `rgba(${R(200, 255)},${R(180, 240)},${R(120, 200)},${R(0.15, 0.35)})`;
      x.beginPath(); x.arc(R(0, w), R(0, h), R(0.02, 0.07) * w, 0, 7); x.fill();
    }
    const cx = w / 2, cy = h * 0.47;
    // Haare
    x.fillStyle = '#4a2f1f'; x.beginPath(); x.ellipse(cx, cy - h * 0.05, w * 0.26, h * 0.3, 0, 0, 7); x.fill();
    x.fillRect(cx - w * 0.26, cy - h * 0.05, w * 0.52, h * 0.38);
    // Hals + Schultern
    x.fillStyle = '#d9a383'; x.fillRect(cx - w * 0.07, cy + h * 0.18, w * 0.14, h * 0.15);
    x.fillStyle = '#b83b4b'; x.beginPath(); x.ellipse(cx, h * 1.02, w * 0.38, h * 0.2, 0, 0, 7); x.fill();
    // Gesicht mit Schattierung
    const fg = x.createRadialGradient(cx - w * 0.06, cy - h * 0.06, w * 0.02, cx, cy, w * 0.26);
    fg.addColorStop(0, '#f6cdb0'); fg.addColorStop(0.7, '#e3a988'); fg.addColorStop(1, '#b97a5c');
    x.fillStyle = fg; x.beginPath(); x.ellipse(cx, cy, w * 0.18, h * 0.24, 0, 0, 7); x.fill();
    // Augen
    for (const s of [-1, 1]) {
      x.fillStyle = '#ffffff'; x.beginPath(); x.ellipse(cx + s * w * 0.07, cy - h * 0.04, w * 0.035, h * 0.018, 0, 0, 7); x.fill();
      x.fillStyle = '#3d6b4a'; x.beginPath(); x.arc(cx + s * w * 0.07, cy - h * 0.04, w * 0.015, 0, 7); x.fill();
      x.fillStyle = '#111'; x.beginPath(); x.arc(cx + s * w * 0.07, cy - h * 0.04, w * 0.007, 0, 7); x.fill();
      x.strokeStyle = '#4a2f1f'; x.lineWidth = w * 0.008; x.beginPath(); x.moveTo(cx + s * w * 0.04, cy - h * 0.08); x.lineTo(cx + s * w * 0.1, cy - h * 0.085); x.stroke();
    }
    // Nase, Mund
    x.strokeStyle = 'rgba(150,90,60,0.6)'; x.lineWidth = w * 0.006; x.beginPath(); x.moveTo(cx, cy - h * 0.01); x.lineTo(cx - w * 0.015, cy + h * 0.06); x.lineTo(cx + w * 0.01, cy + h * 0.065); x.stroke();
    x.fillStyle = '#c4505a'; x.beginPath(); x.ellipse(cx, cy + h * 0.12, w * 0.05, h * 0.016, 0, 0, 7); x.fill();
    texture(c, 0.12);
    const b = blurCopy(c, Math.max(1, w / 400));
    noise(b.getContext('2d'), w, h, 12);
    return b;
  }

  function flowers(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    const bg = x.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#5b8c3a'); bg.addColorStop(1, '#1f3d1a');
    x.fillStyle = bg; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      x.fillStyle = `rgba(${R(30, 90)},${R(90, 160)},${R(30, 70)},0.6)`;
      x.beginPath(); x.ellipse(R(0, w), R(0, h), R(0.02, 0.06) * w, R(0.08, 0.2) * h, R(-1, 1), 0, 7); x.fill();
    }
    const cols = [['#ff6f91', '#c2185b'], ['#ffd54f', '#f57f17'], ['#ffffff', '#c7c7e0'], ['#ba68c8', '#6a1b9a']];
    for (let i = 0; i < 5; i++) {
      const fx = R(0.15, 0.85) * w, fy = R(0.15, 0.85) * h, fr = R(0.1, 0.18) * w;
      const [a, b] = cols[i % cols.length];
      const n = Math.floor(R(5, 9));
      for (let k = 0; k < n; k++) {
        const ang = (k / n) * Math.PI * 2 + R(0, 0.3);
        const g = x.createRadialGradient(fx, fy, 0, fx, fy, fr);
        g.addColorStop(0, b); g.addColorStop(1, a);
        x.fillStyle = g; x.beginPath(); x.ellipse(fx + Math.cos(ang) * fr * 0.55, fy + Math.sin(ang) * fr * 0.55, fr * 0.5, fr * 0.22, ang, 0, 7); x.fill();
      }
      x.fillStyle = '#f9a825'; x.beginPath(); x.arc(fx, fy, fr * 0.18, 0, 7); x.fill();
      x.fillStyle = '#6d4c1d'; x.beginPath(); x.arc(fx, fy, fr * 0.09, 0, 7); x.fill();
    }
    texture(c, 0.25);
    const b = blurCopy(c, Math.max(1, w / 450));
    noise(b.getContext('2d'), w, h, 16);
    return b;
  }

  function stillLife(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#e9dcc8'; x.fillRect(0, 0, w, h * 0.6);
    const tg = x.createLinearGradient(0, h * 0.6, 0, h);
    tg.addColorStop(0, '#8a5a3a'); tg.addColorStop(1, '#4e301e');
    x.fillStyle = tg; x.fillRect(0, h * 0.6, w, h * 0.4);
    // Schale
    x.fillStyle = '#2f5d8a'; x.beginPath(); x.ellipse(w * 0.5, h * 0.7, w * 0.3, h * 0.1, 0, 0, Math.PI); x.fill();
    const fruits = [['#e53935', '#7f0000'], ['#fdd835', '#c49000'], ['#ff9800', '#b35900'], ['#7cb342', '#33691e'], ['#8e24aa', '#38006b']];
    for (let i = 0; i < 7; i++) {
      const fx = w * R(0.28, 0.72), fy = h * R(0.55, 0.68), fr = w * R(0.06, 0.1);
      const [a, b] = fruits[i % fruits.length];
      x.fillStyle = 'rgba(0,0,0,0.25)'; x.beginPath(); x.ellipse(fx + fr * 0.3, fy + fr * 0.8, fr, fr * 0.3, 0, 0, 7); x.fill();
      const g = x.createRadialGradient(fx - fr * 0.4, fy - fr * 0.4, fr * 0.1, fx, fy, fr);
      g.addColorStop(0, '#ffffff'); g.addColorStop(0.15, a); g.addColorStop(1, b);
      x.fillStyle = g; x.beginPath(); x.arc(fx, fy, fr, 0, 7); x.fill();
    }
    x.fillStyle = '#244a6e'; x.beginPath(); x.ellipse(w * 0.5, h * 0.7, w * 0.3, h * 0.035, 0, 0, 7); x.fill();
    // Fenster-Licht
    x.fillStyle = 'rgba(255,255,240,0.25)'; x.fillRect(w * 0.7, h * 0.05, w * 0.22, h * 0.4);
    texture(c, 0.15);
    const b = blurCopy(c, Math.max(1, w / 450));
    noise(b.getContext('2d'), w, h, 12);
    return b;
  }

  function beach(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h * 0.5);
    g.addColorStop(0, '#ff9a5a'); g.addColorStop(0.6, '#ffc98a'); g.addColorStop(1, '#ffe7c2');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#fff3d0'; x.beginPath(); x.arc(w * 0.35, h * 0.42, w * 0.08, 0, 7); x.fill();
    const sea = x.createLinearGradient(0, h * 0.48, 0, h * 0.72);
    sea.addColorStop(0, '#5f7fa8'); sea.addColorStop(1, '#2f8ea0');
    x.fillStyle = sea; x.fillRect(0, h * 0.48, w, h * 0.26);
    x.fillStyle = 'rgba(255,240,200,0.6)';
    for (let i = 0; i < 12; i++) x.fillRect(w * 0.35 - R(0.02, 0.1) * w, h * (0.5 + i * 0.018), R(0.04, 0.2) * w, h * 0.006);
    x.fillStyle = '#e8cf9f'; x.beginPath(); x.moveTo(0, h * 0.74); x.quadraticCurveTo(w * 0.5, h * 0.69, w, h * 0.76); x.lineTo(w, h); x.lineTo(0, h); x.fill();
    // Person (Silhouette) + Schirm
    x.fillStyle = '#2b2b3a'; x.beginPath(); x.arc(w * 0.7, h * 0.6, w * 0.018, 0, 7); x.fill(); x.fillRect(w * 0.688, h * 0.62, w * 0.024, h * 0.12);
    x.fillStyle = '#d23c3c'; x.beginPath(); x.moveTo(w * 0.2, h * 0.68); x.quadraticCurveTo(w * 0.28, h * 0.58, w * 0.36, h * 0.68); x.fill();
    x.strokeStyle = '#555'; x.lineWidth = w * 0.004; x.beginPath(); x.moveTo(w * 0.28, h * 0.66); x.lineTo(w * 0.28, h * 0.84); x.stroke();
    texture(c, 0.2);
    const b = blurCopy(c, Math.max(1, w / 500));
    noise(b.getContext('2d'), w, h, 18);
    return b;
  }

  function garden(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h * 0.35);
    g.addColorStop(0, '#8fbce6'); g.addColorStop(1, '#e6f0f7');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.fillStyle = '#3f6e2f'; x.fillRect(0, h * 0.3, w, h * 0.7);
    const greens = ['#2f5a24', '#4b7f34', '#6a9f45', '#86b85a', '#a7cc6b', '#355e3b', '#1f3f1f'];
    for (let i = 0; i < 2600; i++) {
      const lx = R(0, w), ly = R(0.22, 1) * h, lr = R(0.006, 0.02) * w * (0.5 + (ly / h));
      x.fillStyle = greens[Math.floor(rnd() * greens.length)];
      x.beginPath(); x.ellipse(lx, ly, lr, lr * 0.45, R(0, 3.14), 0, 7); x.fill();
    }
    // Weg
    x.fillStyle = '#c9b08a'; x.beginPath(); x.moveTo(w * 0.42, h); x.quadraticCurveTo(w * 0.5, h * 0.6, w * 0.55, h * 0.45); x.lineTo(w * 0.58, h * 0.45); x.quadraticCurveTo(w * 0.6, h * 0.6, w * 0.68, h); x.fill();
    const fl = ['#ff5a7a', '#ffd23f', '#ffffff', '#b06ad9', '#ff8c42'];
    for (let i = 0; i < 420; i++) {
      const fx = R(0, w), fy = R(0.45, 1) * h, fr = R(0.004, 0.011) * w * (fy / h);
      x.fillStyle = fl[Math.floor(rnd() * fl.length)];
      x.beginPath(); x.arc(fx, fy, fr, 0, 7); x.fill();
    }
    texture(c, 0.18);
    const b = blurCopy(c, Math.max(1, w / 600));
    noise(b.getContext('2d'), w, h, 14);
    return b;
  }

  function city(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, h * 0.7);
    g.addColorStop(0, '#1d2350'); g.addColorStop(0.6, '#8a4f7d'); g.addColorStop(1, '#f2a65a');
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    let bx = 0;
    while (bx < w) {
      const bw = R(0.05, 0.12) * w, bh = R(0.25, 0.65) * h;
      x.fillStyle = `rgb(${R(25, 60)},${R(25, 50)},${R(50, 80)})`;
      x.fillRect(bx, h - bh, bw, bh);
      for (let wy = h - bh + 10; wy < h - 20; wy += h * 0.03) {
        for (let wx = bx + 6; wx < bx + bw - 10; wx += w * 0.018) {
          x.fillStyle = rnd() < 0.45 ? `rgba(255,${R(190, 230)},${R(110, 160)},0.95)` : 'rgba(20,20,40,0.6)';
          x.fillRect(wx, wy, w * 0.009, h * 0.016);
        }
      }
      bx += bw + R(0, 0.02) * w;
    }
    texture(c, 0.1);
    const b = blurCopy(c, Math.max(1, w / 700));
    noise(b.getContext('2d'), w, h, 10);
    return b;
  }

  function transparentPng(w, h) {
    const c = canvas(w, h), x = c.getContext('2d');
    x.fillStyle = '#ff5a7a'; x.beginPath(); x.arc(w * 0.5, h * 0.5, w * 0.35, 0, 7); x.fill();
    x.fillStyle = '#3d7bd9'; x.fillRect(w * 0.2, h * 0.2, w * 0.25, h * 0.25);
    return c;
  }

  const list = [
    ['landschaft.jpg', landscape(1600, 1200), 'image/jpeg'],
    ['portraet.jpg', face(900, 1200), 'image/jpeg'],
    ['blumen.jpg', flowers(1400, 1050), 'image/jpeg'],
    ['stillleben.jpg', stillLife(1200, 1200), 'image/jpeg'],
    ['strand.jpg', beach(1500, 1000), 'image/jpeg'],
    ['riesig-12mp.jpg', landscape(4032, 3024), 'image/jpeg'],
    ['panorama.jpg', beach(2400, 600), 'image/jpeg'],
    ['garten.jpg', garden(1600, 1200), 'image/jpeg'],
    ['stadt.jpg', city(1200, 1500), 'image/jpeg'],
    ['transparent.png', transparentPng(300, 300), 'image/png'],
    ['winzig.png', face(48, 64), 'image/png'],
  ];
  const out = [];
  for (const [name, c, type] of list) out.push([name, c.toDataURL(type, 0.9)]);
  return out;
});

for (const [name, url] of images) {
  fs.writeFileSync(path.join(OUT, name), Buffer.from(url.split(',')[1], 'base64'));
  console.log('geschrieben:', path.join(OUT, name));
}
await browser.close();

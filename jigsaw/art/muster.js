// Farbspiele: abstrakte Muster – Papierwellen, Kreise, Mosaik, Bögen, Aquarell, Terrazzo.
import { mix, lighten, darken, rgba, ramp, vgrad, grain, vignette, TAU } from './kit.js';

export const STYLES = ['wellen', 'kreise', 'mosaik', 'boegen', 'aquarell', 'terrazzo'];

function shuffled(rng, arr) {
  return rng.shuffle(arr.slice());
}

const STYLE_FNS = {
  // Geschichtete Papierwellen mit weichem Schatten
  wellen(ctx, P, rng, cols) {
    const { w, h } = P;
    const n = rng.int(9, 13);
    ctx.fillStyle = cols[0];
    ctx.fillRect(0, 0, w, h);
    const ordered = rng.chance(0.5) ? cols : cols.slice().reverse();
    for (let i = 1; i <= n; i++) {
      const t = i / (n + 1);
      const base = h * (t * 1.08 - 0.04);
      const comps = [0, 1, 2].map((k) => ({ f: rng.range(0.6, 1.6) * (k + 1), p: rng.range(0, TAU), a: rng.range(20, 60) / (k + 1) }));
      const yAtX = (x) => base + comps.reduce((s, c) => s + c.a * Math.sin((x / w) * Math.PI * c.f + c.p), 0);
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(-10, h + 10);
        for (let x = -10; x <= w + 10; x += 10) ctx.lineTo(x, yAtX(x));
        ctx.lineTo(w + 10, h + 10);
        ctx.closePath();
      };
      // Schatten
      ctx.save();
      ctx.translate(0, -10);
      path();
      ctx.fillStyle = rgba('#000000', 0.08);
      ctx.fill();
      ctx.translate(0, 5);
      path();
      ctx.fill();
      ctx.restore();
      const col = ramp(ordered, t);
      path();
      ctx.fillStyle = vgrad(ctx, base - 60, base + 160, [lighten(col, 0.08), col]);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.25);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let x = -10; x <= w + 10; x += 10) (x === -10 ? ctx.moveTo(x, yAtX(x) + 1) : ctx.lineTo(x, yAtX(x) + 1));
      ctx.stroke();
      // kleine Punkte als Muster auf manchen Wellen
      if (rng.chance(0.3)) {
        ctx.fillStyle = rgba('#ffffff', 0.35);
        for (let x = rng.range(10, 40); x < w; x += 36) {
          const y = yAtX(x) + 28;
          ctx.beginPath(); ctx.arc(x, y, 4, 0, TAU); ctx.fill();
        }
      }
    }
  },
  // Überlagerte Kreise und Ringe
  kreise(ctx, P, rng, cols, bg) {
    const { w, h } = P;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 26; i++) {
      const x = rng.range(-0.1, 1.1) * w, y = rng.range(-0.1, 1.1) * h, r = rng.range(60, 300) * (i < 6 ? 1.4 : 1);
      const col = cols[i % cols.length];
      ctx.globalCompositeOperation = i % 3 === 0 ? 'multiply' : 'source-over';
      if (rng.chance(0.3)) {
        ctx.strokeStyle = rgba(col, 0.85);
        ctx.lineWidth = rng.range(10, 40);
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
      } else {
        const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        g.addColorStop(0, rgba(lighten(col, 0.15), 0.85));
        g.addColorStop(1, rgba(col, 0.85));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 70; i++) {
      ctx.fillStyle = rgba(rng.chance(0.5) ? '#ffffff' : darken(cols[i % cols.length], 0.3), 0.7);
      ctx.beginPath(); ctx.arc(rng.range(0, w), rng.range(0, h), rng.range(3, 12), 0, TAU); ctx.fill();
    }
  },
  // Low-Poly-Mosaik mit sanftem Farbverlauf
  mosaik(ctx, P, rng, cols) {
    const { w, h } = P;
    const nx = 10, ny = Math.round(nx * h / w);
    const pts = [];
    for (let j = 0; j <= ny; j++) {
      pts.push([]);
      for (let i = 0; i <= nx; i++) {
        const edgeX = i === 0 || i === nx, edgeY = j === 0 || j === ny;
        pts[j].push([(i / nx) * w + (edgeX ? 0 : rng.range(-0.38, 0.38) * w / nx), (j / ny) * h + (edgeY ? 0 : rng.range(-0.38, 0.38) * h / ny)]);
      }
    }
    const ang = rng.range(0, TAU), ca = Math.cos(ang), sa = Math.sin(ang);
    const fx = rng.range(1, 2.4), ph = rng.range(0, TAU);
    const colorAt = (x, y) => {
      const u = ((x / w - 0.5) * ca + (y / h - 0.5) * sa) + 0.5;
      const v = 0.5 + 0.5 * Math.sin(u * Math.PI * fx + ph) * 0.35 + (u - 0.5) * 0.65;
      return ramp(cols, Math.max(0, Math.min(1, v)));
    };
    const tri = (a, b, c) => {
      const cx = (a[0] + b[0] + c[0]) / 3, cy = (a[1] + b[1] + c[1]) / 3;
      const nrm = ((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])) > 0 ? 1 : -1;
      const shade = rng.range(-0.08, 0.1) + nrm * 0.02;
      const base = colorAt(cx, cy);
      ctx.fillStyle = shade > 0 ? lighten(base, shade) : darken(base, -shade);
      ctx.strokeStyle = ctx.fillStyle;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.closePath();
      ctx.fill(); ctx.stroke();
    };
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const a = pts[j][i], b = pts[j][i + 1], c = pts[j + 1][i], d = pts[j + 1][i + 1];
        if ((i + j) % 2) { tri(a, b, d); tri(a, d, c); } else { tri(a, b, c); tri(b, d, c); }
      }
    }
  },
  // Kacheln mit Bögen, Halbkreisen und Streifen
  boegen(ctx, P, rng, cols, bg) {
    const { w, h } = P;
    const nx = 4, ny = Math.round(nx * h / w);
    const cw = w / nx, ch = h / ny;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const x = i * cw, y = j * ch;
        const c1 = cols[rng.int(0, cols.length - 1)];
        let c2 = cols[rng.int(0, cols.length - 1)];
        if (c2 === c1) c2 = bg;
        ctx.fillStyle = c1;
        ctx.fillRect(x, y, cw + 0.5, ch + 0.5);
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.clip();
        ctx.translate(x + cw / 2, y + ch / 2);
        ctx.rotate(rng.int(0, 3) * Math.PI / 2);
        const s = Math.min(cw, ch);
        const kind = rng.int(0, 4);
        ctx.fillStyle = c2;
        if (kind === 0) { // Viertelkreis
          ctx.beginPath(); ctx.moveTo(-s / 2, -s / 2); ctx.arc(-s / 2, -s / 2, s, 0, Math.PI / 2); ctx.closePath(); ctx.fill();
        } else if (kind === 1) { // Halbkreis
          ctx.beginPath(); ctx.arc(0, s / 2, s / 2, Math.PI, TAU); ctx.fill();
        } else if (kind === 2) { // Regenbogen-Ringe
          const ring = [c2, bg, cols[(cols.indexOf(c1) + 2) % cols.length], bg];
          for (let k = 0; k < 4; k++) {
            ctx.fillStyle = ring[k % ring.length];
            ctx.beginPath(); ctx.arc(0, s / 2, s * (0.95 - k * 0.2), Math.PI, TAU); ctx.fill();
          }
        } else if (kind === 3) { // Kreis mit Punkt
          ctx.beginPath(); ctx.arc(0, 0, s * 0.36, 0, TAU); ctx.fill();
          ctx.fillStyle = c1;
          ctx.beginPath(); ctx.arc(0, 0, s * 0.12, 0, TAU); ctx.fill();
        } else { // Streifen
          for (let k = -4; k <= 4; k += 2) ctx.fillRect(k * s / 9 - s / 18, -s, s / 9, s * 2);
        }
        ctx.restore();
      }
    }
  },
  // Weiche Aquarell-Flecken, die das ganze Blatt füllen
  aquarell(ctx, P, rng, cols, bg) {
    const { w, h } = P;
    ctx.fillStyle = vgrad(ctx, 0, h, [mix(bg, cols[0], 0.18), bg, mix(bg, cols[1], 0.18)]);
    ctx.fillRect(0, 0, w, h);
    const N = 26, V = 40;
    for (let b = 0; b < N; b++) {
      const cx = rng.range(-0.05, 1.05) * w, cy = rng.range(-0.05, 1.05) * h, R = rng.range(120, 300);
      const col = cols[b % cols.length];
      const ph = [rng.range(0, TAU), rng.range(0, TAU), rng.range(0, TAU)];
      const am = [rng.range(0.1, 0.28), rng.range(0.05, 0.15), rng.range(0.02, 0.07)];
      const rAt = (a) => R * (1 + am[0] * Math.sin(2 * a + ph[0]) + am[1] * Math.sin(3 * a + ph[1]) + am[2] * Math.sin(7 * a + ph[2]));
      for (let layer = 0; layer < 8; layer++) {
        ctx.fillStyle = rgba(col, 0.085);
        ctx.beginPath();
        for (let k = 0; k <= V; k++) {
          const a = (k / V) * TAU;
          const r = rAt(a) * (1 - layer * 0.05) * rng.range(0.96, 1.04);
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r * 0.85;
          k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
      }
      ctx.strokeStyle = rgba(darken(col, 0.15), 0.16);
      ctx.lineWidth = 2.5;
      ctx.stroke();
      // Farbsprenkel
      for (let k = 0; k < 6; k++) {
        ctx.fillStyle = rgba(col, rng.range(0.2, 0.45));
        ctx.beginPath();
        ctx.arc(cx + rng.range(-1.3, 1.3) * R, cy + rng.range(-1.3, 1.3) * R, rng.range(2, 8), 0, TAU);
        ctx.fill();
      }
    }
  },
  // Terrazzo: bunte Steinsplitter
  terrazzo(ctx, P, rng, cols, bg) {
    const { w, h } = P;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    // weiche Farbwolken im Untergrund
    for (let i = 0; i < 10; i++) {
      const x = rng.range(0, w), y = rng.range(0, h), r = rng.range(150, 320);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, rgba(cols[i % cols.length], 0.16));
      g.addColorStop(1, rgba(cols[i % cols.length], 0));
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    for (let i = 0; i < 1100; i++) {
      const x = rng.range(-20, w + 20), y = rng.range(-20, h + 20);
      const r = rng.next() ** 2.4 * 46 + 4;
      const k = rng.int(4, 7), rot = rng.range(0, TAU);
      ctx.fillStyle = cols[i % cols.length];
      ctx.beginPath();
      for (let j = 0; j < k; j++) {
        const a = rot + (j / k) * TAU, rr = r * rng.range(0.55, 1.1);
        const px = x + Math.cos(a) * rr, py = y + Math.sin(a) * rr;
        j ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
    }
  },
};

export default {
  id: 'muster',
  title: 'Muster',
  paint(ctx, P) {
    const { rng, pal } = P;
    const o = P.opts || {};
    const style = o.style || STYLES[rng.int(0, STYLES.length - 1)];
    const cols = shuffled(rng, pal.accents && pal.accents.length >= 3 ? pal.accents : [pal.far, pal.near, pal.sun]);
    const bg = pal.sky[0];
    (STYLE_FNS[style] || STYLE_FNS.wellen)(ctx, P, rng, cols, bg);
    grain(ctx, rng, P, 0.09);
    vignette(ctx, P, 0.1);
  },
};

// Bergwelten: Himmel, Sonne, Wolken, gestaffelte Gipfel mit Schnee und Dunst, See oder Wiese.
import {
  mix, lighten, darken, rgba, ramp, vgrad, ridge, hills, yAt, pathBelow, glow, disc, cloud,
  mist, paintSky, pine, brushStrokes, grain, vignette, flower, mountainLayer, TAU,
} from './kit.js';

export default {
  id: 'berge',
  title: 'Berge',
  paint(ctx, P) {
    const { w, h, rng, pal } = P;
    const o = P.opts || {};
    const haze = pal.haze || pal.sky[pal.sky.length - 1];
    const lake = o.lake ?? rng.chance(0.5);
    const snow = o.snow ?? 0.32;
    const layers = o.layers || 4;

    paintSky(ctx, P, h * 0.62);

    // Sonne (oder Mond)
    const sunX = (o.sunX ?? rng.range(0.2, 0.8)) * w;
    const sunY = h * rng.range(0.13, 0.24);
    glow(ctx, sunX, sunY, w * 0.75, pal.sun, 0.4);
    glow(ctx, sunX, sunY, w * 0.2, '#ffffff', 0.3);
    disc(ctx, sunX, sunY, w * rng.range(0.045, 0.06), '#ffffff', pal.sun);

    // Wolken
    const clouds = o.clouds ?? rng.int(2, 4);
    for (let i = 0; i < clouds; i++) {
      const cy = rng.range(0.07, 0.3) * h;
      const sky = ramp(pal.sky, cy / (h * 0.62));
      cloud(ctx, rng, {
        x: rng.range(0.05, 0.95) * w, y: cy, w: rng.range(200, 380), h: rng.range(55, 95),
        light: mix(pal.sun, '#ffffff', 0.5), shade: mix(sky, pal.far, 0.3), alpha: 0.95,
      });
    }

    // Gestaffelte Bergketten von hinten nach vorne
    const light = mix(pal.sun, '#ffffff', 0.25);
    const ridges = [];
    for (let i = 0; i < layers; i++) {
      const t = layers === 1 ? 1 : i / (layers - 1);
      const color = mix(pal.far, pal.near, t);
      const base = h * (0.5 + 0.1 * i);
      const amp = h * [0.31, 0.22, 0.15, 0.11, 0.08][i] * (o.tall || 1);
      const peaks = i === 0 ? [[rng.range(0.25, 0.75), 1.1, 0.1]] : i === 1 ? [[rng.range(0.1, 0.9), 0.6, 0.15]] : null;
      const pts = ridge(rng, { w, base, amp, rough: i < 2 ? 0.55 : 0.48, detail: 7, peaks });
      ridges.push({ pts, color });
      mountainLayer(ctx, rng, P, pts, {
        color, lit: mix(color, light, 0.32 - t * 0.12), shadow: darken(color, 0.15), haze, base, amp, sunX,
        shift: 70 - i * 10, snow: i < 2 ? snow * (i === 0 ? 1 : 0.6) : 0,
        snowLit: mix('#ffffff', pal.sun, 0.25), snowShadow: mix(mix(pal.sky[0], '#ffffff', 0.55), color, 0.2),
      });
      mist(ctx, P, base + h * 0.015, h * 0.045, haze, 0.42 - i * 0.07);
      // Wald auf den vorderen Ketten
      if (i >= layers - 2) {
        const treeColor = darken(color, 0.08 + 0.06 * i);
        const size = 10 + i * 7;
        for (let x = rng.range(0, 20); x < w; x += rng.range(size * 0.3, size * 0.8)) {
          const y = yAt(pts, x) + rng.range(6, 30) + (i === layers - 1 ? rng.range(0, 30) : 0);
          pine(ctx, x, y, size * rng.range(1.5, 2.6), size * rng.range(0.75, 1.05), rgba(treeColor, rng.range(0.75, 0.95)));
        }
      }
    }

    if (lake) {
      // See mit Spiegelung
      const top = h * 0.8;
      const water = mix(pal.far, haze, 0.35);
      ctx.fillStyle = vgrad(ctx, top, h, [mix(haze, water, 0.3), water, darken(mix(water, pal.near, 0.5), 0.05)]);
      ctx.fillRect(0, top, w, h - top);
      for (let k = ridges.length - 1; k >= 0; k--) {
        const { pts, color } = ridges[k];
        const base = h * (0.5 + 0.1 * k);
        ctx.beginPath();
        ctx.moveTo(0, top);
        for (const [x, y] of pts) ctx.lineTo(x, Math.max(top, top + (base - y) * 0.55 - (base - top) * 0.1));
        ctx.lineTo(w, top);
        ctx.closePath();
        ctx.fillStyle = rgba(mix(color, water, 0.4), 0.6);
        ctx.fill();
      }
      // Uferlinie mit gespiegelten Baumspitzen
      ctx.fillStyle = rgba(darken(pal.near, 0.1), 0.55);
      ctx.fillRect(0, top - 2, w, 7);
      ctx.fillStyle = rgba(darken(pal.near, 0.1), 0.28);
      for (let x = rng.range(0, 10); x < w; x += rng.range(6, 16)) {
        const th = rng.range(8, 26), tw = th * 0.45;
        ctx.beginPath();
        ctx.moveTo(x - tw / 2, top + 4);
        ctx.lineTo(x, top + 4 + th);
        ctx.lineTo(x + tw / 2, top + 4);
        ctx.fill();
      }
      // Sonnenglitzern und Wellen
      for (let k = 0; k < 140; k++) {
        const y = rng.range(top + 3, h);
        const spread = 25 + (y - top) * 0.6;
        const x = sunX + rng.range(-spread, spread) * rng.next();
        ctx.fillStyle = rgba(lighten(pal.sun, 0.3), rng.range(0.2, 0.6) * (1 - ((y - top) / (h - top)) * 0.6));
        ctx.beginPath();
        ctx.ellipse(x, y, rng.range(8, 28), rng.range(1, 2.4), 0, 0, TAU);
        ctx.fill();
      }
      brushStrokes(ctx, rng, {
        y0: top, y1: h, count: 180, alpha: 0.3, len: [30, 140], thick: [1.5, 4], tilt: 0.01,
        colorAt: (y) => (Math.sin(y * 1.7) > 0 ? lighten(haze, 0.3) : darken(water, 0.18)),
      });
      // Ufer mit Tannen vorne
      const side = rng.chance(0.5) ? 0 : 1;
      const shore = hills(rng, { w, base: h * 1.02, amp: h * 0.04, waves: 2 });
      ctx.beginPath();
      ctx.moveTo(side ? w : 0, h);
      for (let k = 0; k <= 20; k++) {
        const x = side ? w - k * 18 : k * 18;
        ctx.lineTo(x, h - (1 - k / 20) * h * 0.09 - 4);
      }
      ctx.lineTo(side ? w - 380 : 380, h);
      ctx.closePath();
      ctx.fillStyle = darken(pal.near, 0.12);
      ctx.fill();
      pathBelow(ctx, shore, h, true);
      ctx.fill();
      for (let k = 0; k < 8; k++) {
        const x = side ? w - rng.range(0, 300) : rng.range(0, 300);
        const size = rng.range(70, 150) * (1 - Math.abs(x - (side ? w : 0)) / 500);
        pine(ctx, x, h * 0.99, size * 2.1, size * 0.9, darken(pal.near, rng.range(0.05, 0.3)));
      }
    } else if (o.winter) {
      // Verschneiter Vordergrund
      const field = hills(rng, { w, base: h * 0.86, amp: h * 0.04, waves: 2 });
      pathBelow(ctx, field, h, true);
      ctx.fillStyle = vgrad(ctx, h * 0.8, h, ['#ffffff', mix('#ffffff', pal.sky[0], 0.25), mix('#ffffff', pal.sky[0], 0.45)]);
      ctx.fill();
      for (let k = 0; k < 6; k++) {
        const x = rng.range(0, w), size = rng.range(50, 110);
        pine(ctx, x, h * 0.9 + rng.range(0, 60), size * 2, size * 0.9, darken(pal.near, 0.1));
        // Schnee auf den Ästen
        ctx.fillStyle = rgba('#ffffff', 0.85);
        for (let j = 1; j <= 4; j++) {
          const y = h * 0.9 + 30 - size * 2 + size * 2 * 0.92 * (j / 5);
          ctx.beginPath(); ctx.ellipse(x, y, size * 0.4 * (0.3 + j / 5), size * 0.07, 0, Math.PI, TAU); ctx.fill();
        }
      }
    } else {
      // Blumenwiese im Vordergrund
      const ground = pal.ground || mix(pal.near, '#79a85a', 0.6);
      const meadow = hills(rng, { w, base: h * 0.84, amp: h * 0.04, waves: 2 });
      pathBelow(ctx, meadow, h, true);
      ctx.fillStyle = vgrad(ctx, h * 0.8, h, [lighten(ground, 0.12), ground, darken(ground, 0.3)]);
      ctx.fill();
      ctx.save();
      pathBelow(ctx, meadow, h, true);
      ctx.clip();
      brushStrokes(ctx, rng, { y0: h * 0.8, y1: h, count: 260, alpha: 0.4, len: [14, 50], thick: [2, 5], tilt: 0.5, colorAt: (y) => mix(lighten(ground, 0.2), darken(ground, 0.3), (y - h * 0.8) / (h * 0.2)) });
      const accents = pal.accents || ['#ffffff'];
      const flowers = [];
      for (let k = 0; k < 200; k++) {
        const x = rng.range(0, w);
        const top = yAt(meadow, x);
        const v = rng.next() ** 0.8;
        flowers.push([x, top + 6 + v * (h - top), v]);
      }
      flowers.sort((a, b) => a[1] - b[1]);
      flowers.forEach(([x, y, v], k) => {
        flower(ctx, rng, x, y, 3 + v * v * 14, accents[k % accents.length], k % 3 ? '#ffd24a' : '#f08a2a');
      });
      ctx.restore();
    }

    if (o.snowfall) {
      for (let k = 0; k < 260; k++) {
        const r = rng.next() ** 2 * 4 + 1;
        ctx.fillStyle = rgba('#ffffff', rng.range(0.5, 0.95));
        ctx.beginPath(); ctx.arc(rng.range(0, w), rng.range(0, h), r, 0, TAU); ctx.fill();
      }
    }

    grain(ctx, rng, P, 0.08);
    vignette(ctx, P, 0.15);
  },
};

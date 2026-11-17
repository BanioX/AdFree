// «So geht's»: 4 kurze Schritte mit animierten Mini-Szenen im Spielstil.
// Die Blasen sind dieselben Bilder wie auf dem Spielfeld (sprites.js über art.js).

import { h } from '../shared/ui.js';
import { COLORS } from './data/colors.js';
import { paintEl } from './art.js';

const R = 1, O = 2, Y = 3, G = 4, B = 5, V = 6, P = 7;
const col = (k) => (typeof k === 'number' ? COLORS[k]?.base : null) || '#ffd23a';

/**
 * Mini-Spielfeld in der Tutorial-Bühne. Alle Masse in Pixeln, berechnet aus der Bühnengrösse.
 * Wabenraster wie im Spiel: 9 Blasen in geraden, 8 in ungeraden Reihen (halb versetzt).
 */
function scene(stage, api) {
  const W = stage.clientWidth || 320, H = stage.clientHeight || 250;
  const D = Math.round(Math.min(W / 9.7, H / 6.6));
  const left = (W - 9.5 * D) / 2;
  const ceil = Math.round(D * 0.3);
  const root = h('div.bzt');
  root.style.setProperty('--d', D + 'px');
  root.append(h('div.bzt-ceil', { style: { height: ceil + 'px' } }));
  stage.prepend(root);
  const layer = h('div.bzt-layer');
  root.append(layer);
  const r = Math.round(D / 2);

  const X = (row, c) => left + D / 2 + c * D + (row & 1 ? D / 2 : 0);
  const Yr = (row) => ceil + D * 0.6 + row * D * 0.866;
  const S = { x: W / 2, y: H - D * 1.2 };
  const wallL = left + D / 2, wallR = left + 9.5 * D - D / 2;

  const s = {
    W, H, D, X, Y: Yr, S, wallL, wallR, root, layer,
    bubble(key, x, y, { pet = null, cls = '' } = {}) {
      const b = h('div.bzt-b' + (cls ? '.' + cls : ''));
      paintEl(b, key, r, pet);
      s.place(b, x, y);
      layer.append(b);
      return b;
    },
    cell(row, c, key, opts) { return s.bubble(key, X(row, c), Yr(row), opts); },
    place(el, x, y) { el._x = x; el._y = y; el.style.left = x + 'px'; el.style.top = y + 'px'; },
    /** Fliegt mit gleichmässigem Tempo durch die Punkte. */
    async fly(el, pts, speed = 1.0) {
      el.classList.add('flying');
      for (const p of pts) {
        const ms = Math.max(60, Math.hypot(p.x - el._x, p.y - el._y) / speed);
        el.style.transition = `left ${ms}ms linear, top ${ms}ms linear`;
        s.place(el, p.x, p.y);
        await api.sleep(ms);
      }
      el.style.transition = '';
      el.classList.remove('flying');
      el.classList.remove('land'); void el.offsetWidth; el.classList.add('land');
    },
    pop(el, delay = 0) {
      setTimeout(() => {
        if (!el.isConnected) return;
        el.classList.add('pop');
        const c = col(Number(el.dataset.k));
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + Math.random() * 0.5;
          const d = D * (0.6 + Math.random() * 0.5);
          const p = h('i.bzt-p', { style: { left: el._x + 'px', top: el._y + 'px', '--c': c, '--tx': Math.cos(a) * d + 'px', '--ty': Math.sin(a) * d + 'px' } });
          layer.append(p);
          setTimeout(() => p.remove(), 600);
        }
        const ring = h('i.bzt-ring-fx', { style: { left: el._x + 'px', top: el._y + 'px', '--c': c } });
        layer.append(ring);
        setTimeout(() => ring.remove(), 500);
      }, delay);
    },
    fall(el, delay = 0) {
      setTimeout(() => { if (el.isConnected) { el.style.setProperty('--fy', (H - el._y + D) + 'px'); el.classList.add('fall'); } }, delay);
    },
    text(t, x, y, cls = '') {
      const e = h('div.bzt-txt' + (cls ? '.' + cls : ''), { style: { left: x + 'px', top: y + 'px' } }, t);
      layer.append(e);
      setTimeout(() => e.remove(), 1400);
      return e;
    },
    /** Zielhilfe: gepunktete Linie wie im Spiel */
    aim(pts, key) {
      s.hideAim();
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'bzt-aim');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      const d = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      for (const [cls, w] of [['bg', D * 0.26], ['fg', D * 0.17]]) {
        const pl = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        pl.setAttribute('points', d);
        pl.setAttribute('class', cls);
        pl.setAttribute('stroke-width', w.toFixed(1));
        pl.style.strokeDasharray = `0 ${D * 0.52}`;
        if (cls === 'fg') pl.style.stroke = col(key);
        svg.append(pl);
      }
      s.aimEl = svg;
      root.insertBefore(svg, layer);
    },
    hideAim() { if (s.aimEl) { s.aimEl.remove(); s.aimEl = null; } },
    /** Weg eines Schusses in Richtung (dx, dy) bis zur Höhe yTop, mit einem Wandabpraller. */
    path(dx, dy, yTop) {
      const n = Math.hypot(dx, dy); dx /= n; dy /= n;
      if (dy > -0.1) dy = -0.1;
      const pts = [{ ...S }];
      let x = S.x, y = S.y;
      for (let k = 0; k < 2; k++) {
        const ty = (yTop - y) / dy;
        const tw = dx < 0 ? (wallL - x) / dx : dx > 0 ? (wallR - x) / dx : Infinity;
        if (ty <= tw) { pts.push({ x: x + dx * ty, y: yTop }); return pts; }
        x += dx * tw; y += dy * tw; pts.push({ x, y }); dx = -dx;
      }
      return pts;
    },
    /** Werfer: Sockel + Ring + Kugel */
    shooter(key) {
      layer.append(h('div.bzt-base', { style: { left: S.x + 'px', top: S.y + D * 0.55 + 'px' } }));
      layer.append(h('div.bzt-launch', { style: { left: S.x + 'px', top: S.y + 'px' } }));
      return s.bubble(key, S.x, S.y, { cls: 'cur' });
    },
    clear() { layer.replaceChildren(); s.hideAim(); },
  };
  return s;
}

/** Folgt dem Tutorial-Finger und zeichnet dabei die Zielhilfe. */
function trackAim(stage, s, api, key, yTop) {
  const finger = stage.querySelector('.tut-finger');
  let on = true;
  const tick = () => {
    if (!on || api.signal.aborted || !finger) return;
    const st = getComputedStyle(finger);
    const fx = parseFloat(st.left), fy = parseFloat(st.top);
    if (fy < s.S.y - s.D * 0.6) s.aim(s.path(fx - s.S.x, fy - s.S.y, yTop), key);
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return () => { on = false; };
}

const pct = (s, p) => ({ x: (p.x / s.W) * 100, y: (p.y / s.H) * 100 });

export const STEPS = [
  {
    title: 'Zielen und schiessen',
    text: 'Zieh zum Zielen, lass los – ab drei gleichen Blasen platzt es.',
    demo(stage, api) {
      const s = scene(stage, api);
      return api.loop(async () => {
        s.clear();
        [R, R, B, B, Y, Y, G, G, P].forEach((k, c) => s.cell(0, c, k));
        s.cell(1, 2, Y); s.cell(1, 5, G); s.cell(1, 6, P);
        s.bubble(B, s.S.x - s.D * 2.1, s.S.y + s.D * 0.25, { cls: 'next' });
        const shot = s.shooter(R);
        // Ziel: Reihe 1, ganz links – über die linke Wand
        const T = { x: s.X(1, 0), y: s.Y(1) };
        const xm = 2 * s.wallL - T.x;
        const t = (s.S.x - s.wallL) / (s.S.x - xm);
        const P1 = { x: s.wallL, y: s.S.y + t * (T.y - s.S.y) };
        await api.sleep(300);
        const stop = trackAim(stage, s, api, R, T.y);
        const dir = { x: P1.x - s.S.x, y: P1.y - s.S.y };
        await api.finger.drag([
          pct(s, { x: s.S.x + s.D * 0.2, y: s.S.y - s.D * 1.6 }),
          pct(s, { x: s.S.x + dir.x * 0.25, y: s.S.y + dir.y * 0.25 }),
          pct(s, { x: s.S.x + dir.x * 0.42, y: s.S.y + dir.y * 0.42 }),
        ], 1300);
        stop();
        s.aim([s.S, P1, T], R);
        await api.sleep(250);
        s.hideAim();
        api.finger.hide();
        await s.fly(shot, [P1, T], 0.75);
        const reds = [...s.layer.querySelectorAll('.bzt-b')].filter((b) => b.dataset.k === String(R));
        reds.forEach((b, i) => s.pop(b, 90 + i * 70));
        await api.sleep(320);
        s.text('+30', T.x + s.D * 0.3, T.y + s.D * 0.2);
        await api.sleep(1300);
      }, 200);
    },
  },
  {
    title: 'Feld abräumen',
    text: 'Was nicht mehr hängt, fällt mit – so räumst du alle Blasen ab.',
    demo(stage, api) {
      const s = scene(stage, api);
      return api.loop(async () => {
        s.clear();
        const top = [s.cell(0, 2, B), s.cell(0, 3, B)];
        const hang = [s.cell(1, 2, V), s.cell(1, 3, Y, { pet: '🐣' }), s.cell(2, 3, R), s.cell(2, 4, G), s.cell(3, 3, P)];
        const pet = hang[1];
        const shot = s.shooter(B);
        const T = { x: s.X(1, 1), y: s.Y(1) };
        await api.sleep(250);
        const stop = trackAim(stage, s, api, B, T.y);
        const dir = { x: T.x - s.S.x, y: T.y - s.S.y };
        await api.finger.drag([
          pct(s, { x: s.S.x + s.D * 0.2, y: s.S.y - s.D * 1.5 }),
          pct(s, { x: s.S.x + dir.x * 0.3, y: s.S.y + dir.y * 0.3 }),
          pct(s, { x: s.S.x + dir.x * 0.45, y: s.S.y + dir.y * 0.45 }),
        ], 1100);
        stop();
        s.aim([s.S, T], B);
        await api.sleep(200);
        s.hideAim();
        api.finger.hide();
        await s.fly(shot, [T], 0.75);
        [shot, ...top].forEach((b, i) => s.pop(b, 80 + i * 70));
        await api.sleep(420);
        hang.forEach((b, i) => { if (b !== pet) s.fall(b, i * 50); });
        // Tierchen fliegt frei
        pet.classList.add('pop');
        const fly = h('div.bzt-pet', { style: { left: pet._x + 'px', top: pet._y + 'px' } }, '🐣');
        s.layer.append(fly);
        for (let i = 0; i < 3; i++) s.text('♥', pet._x + (i - 1) * s.D * 0.5, pet._y - s.D * 0.2, 'heart');
        requestAnimationFrame(() => fly.classList.add('go'));
        await api.sleep(900);
        const win = h('div.bzt-win', null, h('b', null, 'Geschafft!'), h('span', null, '★★★'));
        s.layer.append(win);
        await api.sleep(1500);
      }, 200);
    },
  },
  {
    title: 'Tauschen und zaubern',
    text: 'Tipp auf die Kugel zum Tauschen – Treffer in Serie schenken Zauberkugeln.',
    demo(stage, api) {
      const s = scene(stage, api);
      const NX = s.S.x - s.D * 2.1, NY = s.S.y + s.D * 0.25;
      const slots = [2.05, 3.05, 4.05].map((k) => ({ x: s.S.x + s.D * k, y: s.S.y + s.D * 0.25 }));
      return api.loop(async () => {
        s.clear();
        [G, G, V, V, Y, B, B, V, G].forEach((k, c) => s.cell(0, c, k));
        [V, G, Y, Y, R, V, G, Y].forEach((k, c) => s.cell(1, c, k));
        slots.forEach((p) => s.layer.append(h('div.bzt-slot', { style: { left: p.x + 'px', top: p.y + 'px' } })));
        const dots = h('div.bzt-dots', { style: { left: s.S.x + 'px', top: s.S.y + s.D * 0.86 + 'px' } }, [0, 1, 2, 3].map((i) => h('i' + (i < 3 ? '.on' : ''))));
        s.layer.append(dots);
        const next = s.bubble(B, NX, NY, { cls: 'next' });
        let cur = s.shooter(R);
        await api.sleep(350);
        // 1) Tauschen
        await api.finger.tap({ x: (s.S.x / s.W) * 100, y: (s.S.y / s.H) * 100 });
        s.place(cur, NX, NY); cur.classList.remove('cur'); cur.classList.add('next');
        s.place(next, s.S.x, s.S.y); next.classList.remove('next'); next.classList.add('cur');
        cur = next;
        await api.sleep(500);
        // 2) Blau zu den Blauen: Serie voll → Bombe
        const T = { x: s.X(2, 5), y: s.Y(2) };
        s.aim([s.S, T], B);
        await api.finger.tap(pct(s, { x: s.S.x + (T.x - s.S.x) * 0.45, y: s.S.y + (T.y - s.S.y) * 0.45 }), 450);
        s.hideAim();
        api.finger.hide();
        await s.fly(cur, [T], 0.75);
        const blues = [...s.layer.querySelectorAll('.bzt-b')].filter((b) => b.dataset.k === String(B) && b._y < s.S.y - s.D);
        blues.forEach((b, i) => s.pop(b, 60 + i * 70));
        await api.sleep(300);
        dots.lastChild.classList.add('on');
        const bomb = s.bubble('bomb', T.x, T.y, { cls: 'special' });
        await api.sleep(200);
        s.text('Bombe erhalten!', s.W / 2, s.Y(3.2), 'banner');
        await s.fly(bomb, [slots[0]], 0.6);
        bomb.classList.add('small');
        [...dots.children].forEach((d) => d.classList.remove('on'));
        await api.sleep(250);
        // 3) Zauberkugel wählen und abfeuern
        await api.finger.tap(pct(s, slots[0]), 500);
        bomb.classList.remove('small');
        s.place(bomb, s.S.x, s.S.y + s.D * 0.02);
        await api.sleep(450);
        const T2 = { x: s.X(1, 3), y: s.Y(1) + s.D * 0.9 };
        await api.finger.tap(pct(s, { x: s.S.x + (T2.x - s.S.x) * 0.5, y: s.S.y + (T2.y - s.S.y) * 0.5 }), 450);
        api.finger.hide();
        await s.fly(bomb, [T2], 0.8);
        const boom = h('i.bzt-boom', { style: { left: T2.x + 'px', top: T2.y + 'px' } });
        s.layer.append(boom);
        bomb.classList.add('pop');
        const near = [...s.layer.querySelectorAll('.bzt-b')].filter((b) => b !== bomb && b._y < s.S.y - s.D && Math.hypot(b._x - T2.x, b._y - T2.y) < s.D * 2.1);
        near.forEach((b, i) => s.pop(b, 40 + i * 35));
        await api.sleep(1300);
      }, 200);
    },
  },
  {
    title: 'Levels oder Entspannt',
    text: 'Sammle Sterne in den Levels oder spiel ganz entspannt ohne Schusslimit.',
    demo(stage, api) {
      const s = scene(stage, api);
      s.root.classList.add('modes');
      const seg = h('div.bzt-seg', null, h('span.on', null, 'Levels'), h('span', null, 'Entspannt'));
      const lv = h('div.bzt-lvs');
      const endless = h('div.bzt-endless');
      s.root.append(seg, lv, endless);
      const STAR = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg>';
      const buildLevels = () => {
        lv.replaceChildren();
        const cols = [R, Y, G];
        for (let n = 1; n <= 4; n++) {
          const b = h('div.bzt-lv' + (n < 3 ? '.done' : n === 3 ? '.cur' : ''), null, String(n));
          if (n < 3) paintEl(b, cols[n - 1], Math.round(s.D * 0.75));
          b.append(h('span.st', { html: [0, 1, 2].map((i) => `<i class="${n < 3 && (n === 1 || i < 2) ? 'on' : ''}">${STAR}</i>`).join('') }));
          lv.append(b);
        }
      };
      const fillRows = () => {
        endless.replaceChildren();
        const keys = [R, B, Y, G, V, P];
        for (let row = 0; row < 3; row++) {
          const line = h('div.bzt-row' + (row & 1 ? '.odd' : ''));
          for (let c = 0; c < (row & 1 ? 8 : 9); c++) line.append(paintEl(h('i'), keys[(c * 7 + row * 3) % 6], Math.round(s.D * 0.4)));
          endless.append(line);
        }
        endless.append(h('div.bzt-inf', null, '∞', h('small', null, 'ohne Schusslimit')));
      };
      const show = (mode) => {
        seg.children[0].classList.toggle('on', mode === 'levels');
        seg.children[1].classList.toggle('on', mode !== 'levels');
        lv.classList.toggle('on', mode === 'levels');
        endless.classList.toggle('on', mode !== 'levels');
      };
      return api.loop(async () => {
        buildLevels(); fillRows(); show('levels');
        await api.sleep(500);
        // drittes Level: Sterne erscheinen nacheinander
        const third = lv.children[2];
        paintEl(third, B, Math.round(s.D * 0.75));
        third.classList.remove('cur'); third.classList.add('done');
        const stars = third.querySelectorAll('.st i');
        for (const st of stars) { await api.sleep(260); st.classList.add('on', 'pop'); }
        lv.children[3].classList.add('cur');
        await api.sleep(900);
        await api.finger.tap(seg.children[1]);
        show('endless');
        api.finger.hide();
        for (let k = 0; k < 2; k++) {
          await api.sleep(800);
          const keys = [G, P, B, Y, R, V];
          const line = h('div.bzt-row.new' + (k & 1 ? '' : '.odd'));
          for (let c = 0; c < (k & 1 ? 9 : 8); c++) line.append(paintEl(h('i'), keys[(c * 5 + k) % 6], Math.round(s.D * 0.4)));
          endless.prepend(line);
        }
        await api.sleep(900);
        await api.finger.tap(seg.children[0]);
        show('levels');
        api.finger.hide();
        await api.sleep(600);
      }, 300);
    },
  },
];

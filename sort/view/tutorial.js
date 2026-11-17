// Farbfluss – «So geht's»: animierte Mini-Demos für das gemeinsame Tutorial (/shared/tutorial.js).
//
// Jede Demo baut kleine Gläser (SVG) in die Bühne, ein Finger tippt sie an, und das Glas
// fliegt hinüber, kippt und giesst – wie im echten Spiel, nur in klein.
// Texte und Reihenfolge der Schritte stehen in data/texts.js (howTo).

import { h, icon } from '../../shared/ui.js';
import { liquids } from '../data/colors.js';

let mini = 0;
const MT = { w: 16, lh: 9, top: 5 };

/** Kleine SVG-Illustration eines Glases. cols = Farben von unten nach oben. */
export function miniTube(x, y, cols, { cork = false, cap = 4 } = {}) {
  const { w, lh, top } = MT;
  const H = top + cap * lh + 2.5;
  const id = 'mt' + (++mini);
  const shape = `M1.6 0 V${H - w / 2} a6.4 6.4 0 0 0 12.8 0 V0 Z`;
  let s = `<g transform="translate(${x},${y})">`;
  s += `<clipPath id="${id}"><path d="${shape}"/></clipPath>`;
  s += `<path d="${shape}" fill="#ffffff" fill-opacity=".8"/>`;
  s += `<g clip-path="url(#${id})">`;
  cols.forEach((c, i) => {
    const y1 = H - 1.2 - i * lh;
    s += `<rect x="0" y="${y1 - lh}" width="${w}" height="${lh + (i === 0 ? 4 : 0.4)}" fill="${c}"/>`;
  });
  s += `<rect x="3.4" y="${top + 3}" width="2.4" height="${H - top - 12}" rx="1.2" fill="#fff" opacity=".55"/></g>`;
  s += `<path d="M0.8 1.5 V${H - w / 2} a7.2 7.2 0 0 0 14.4 0 V1.5" fill="none" stroke="#6f8aa0" stroke-opacity=".75" stroke-width="1.3"/>`;
  s += `<rect x="-0.8" y="-1" width="17.6" height="3" rx="1.5" fill="#fff" stroke="#6f8aa0" stroke-opacity=".75" stroke-width="1"/>`;
  if (cork) s += `<path d="M2.5 -4.5 h11 l-1 6.5 h-9 z" fill="#d9a46b" stroke="#8a5a2e" stroke-width="1"/>`;
  s += '</g>';
  return s;
}

const C = (id) => liquids.find((x) => x.id === id).color;

/** Ein Demo-Glas als eigenes Element (lässt sich per CSS bewegen und kippen). */
function demoTube(stage, xPct, cols, opts = {}) {
  const el = h('div.tt-tube');
  el.style.left = `calc(${xPct}% - 24px)`;
  const set = (c, o = {}) => {
    cols = c;
    const H = MT.top + 4 * MT.lh + 2.5;
    el.innerHTML = `<svg viewBox="-2 -7 20 ${H + 9}" aria-hidden="true">${miniTube(0, 0, c, o)}</svg>`;
  };
  set(cols, opts);
  stage.append(el);
  return {
    el,
    set,
    get cols() { return cols; },
    lift(on) { el.classList.toggle('up', on); },
    shake() { el.classList.remove('no'); void el.offsetWidth; el.classList.add('no'); },
  };
}

/**
 * Glas a giesst `n` Schichten in Glas b: anheben, hinüberfliegen, kippen, Strahl, zurück.
 */
async function demoPour(stage, api, a, b, n) {
  const color = a.cols[a.cols.length - 1];
  const dir = b.el.offsetLeft > a.el.offsetLeft ? 1 : -1;
  const aw = a.el.offsetWidth, ah = a.el.offsetHeight;
  // Drehpunkt: obere Ecke zur Zielseite hin; Ziel: knapp über dem Rand des Zielglases
  const ox = a.el.offsetLeft + (dir > 0 ? aw * 0.86 : aw * 0.14);
  const oy = a.el.offsetTop + ah * 0.1;
  const tx = b.el.offsetLeft + b.el.offsetWidth * (dir > 0 ? 0.36 : 0.64);
  const ty = b.el.offsetTop - ah * 0.1;
  a.el.style.transformOrigin = dir > 0 ? '86% 10%' : '14% 10%';
  a.el.classList.remove('up');
  a.el.style.transform = `translate(${tx - ox}px, ${ty - oy}px) rotate(${dir * 78}deg)`;
  await api.sleep(480);
  const jet = h('div.tt-jet');
  jet.style.left = `${tx - 3}px`;
  jet.style.top = `${ty}px`;
  jet.style.height = `${b.el.offsetTop + b.el.offsetHeight * 0.9 - ty - (b.cols.length + n) * b.el.offsetHeight * 0.17}px`;
  jet.style.background = color;
  stage.append(jet);
  requestAnimationFrame(() => jet.classList.add('on'));
  await api.sleep(260);
  a.set(a.cols.slice(0, a.cols.length - n));
  const done = b.cols.length + n === 4 && b.cols.every((c) => c === color);
  b.set([...b.cols, ...Array(n).fill(color)], { cork: false });
  await api.sleep(300);
  jet.classList.remove('on');
  setTimeout(() => jet.remove(), 300);
  a.el.style.transform = '';
  await api.sleep(460);
  return done;
}

function sparkle(stage, tube) {
  const s = h('div.tt-spark', null, '✨');
  s.style.left = `${tube.el.offsetLeft + tube.el.offsetWidth / 2}px`;
  s.style.top = `${tube.el.offsetTop - 10}px`;
  stage.append(s);
  setTimeout(() => s.remove(), 900);
}

function scene(stage) {
  const sc = h('div.tt-scene');
  stage.append(sc);
  return sc;
}

const DEMOS = {
  /** Kernaktion: antippen, antippen – die oberste Farbe fliesst hinüber. */
  tap(stage, api) {
    const sc = scene(stage);
    const r = C('rot'), b = C('blau'), y = C('gelb'), g = C('gruen');
    const A = demoTube(sc, 32, [b, y, r]);
    const B = demoTube(sc, 68, [g, r]);
    return api.loop(async () => {
      A.set([b, y, r]); B.set([g, r]);
      await api.sleep(300);
      await api.finger.tap(A.el);
      A.lift(true);
      await api.sleep(250);
      await api.finger.tap(B.el);
      api.finger.hide();
      await demoPour(sc, api, A, B, 1);
      await api.sleep(900);
    }, 300);
  },

  /** Regel: nur auf dieselbe Farbe oder ins leere Glas. */
  rule(stage, api) {
    const sc = scene(stage);
    const r = C('rot'), b = C('blau'), g = C('gruen');
    const A = demoTube(sc, 20, [b, r]);
    const B = demoTube(sc, 50, [g, b]);
    const E = demoTube(sc, 80, []);
    const no = h('div.tt-badge.bad', { html: icon('close', { size: 16 }) });
    sc.append(no);
    return api.loop(async () => {
      A.set([b, r]); B.set([g, b]); E.set([]);
      no.classList.remove('show');
      await api.sleep(300);
      await api.finger.tap(A.el);
      A.lift(true);
      await api.sleep(200);
      await api.finger.tap(B.el);
      A.lift(false);
      B.shake();
      no.style.left = `${B.el.offsetLeft + B.el.offsetWidth / 2}px`;
      no.style.top = `${B.el.offsetTop - 16}px`;
      no.classList.add('show');
      await api.sleep(700);
      no.classList.remove('show');
      await api.finger.tap(A.el);
      A.lift(true);
      await api.sleep(200);
      await api.finger.tap(E.el);
      api.finger.hide();
      await demoPour(sc, api, A, E, 1);
      await api.sleep(900);
    }, 300);
  },

  /** Ziel: jedes Glas eine Farbe – volle Gläser bekommen einen Korken. */
  goal(stage, api) {
    const sc = scene(stage);
    const r = C('rot'), b = C('blau'), y = C('gelb');
    const A = demoTube(sc, 20, [r, r, r]);
    const B = demoTube(sc, 50, [b, b, b, b], { cork: true });
    const D = demoTube(sc, 80, [y, y, y, y, r].slice(1));
    return api.loop(async () => {
      A.set([r, r, r]); D.set([y, y, y, r]);
      await api.sleep(300);
      await api.finger.tap(D.el);
      D.lift(true);
      await api.sleep(200);
      await api.finger.tap(A.el);
      api.finger.hide();
      const done = await demoPour(sc, api, D, A, 1);
      if (done) {
        A.set([r, r, r, r], { cork: true });
        A.el.classList.remove('pop'); void A.el.offsetWidth; A.el.classList.add('pop');
        sparkle(sc, A);
        await api.sleep(200);
        D.set([y, y, y], { cork: false });
      }
      await api.sleep(1300);
    }, 300);
  },

  /** Hilfen: Rückgängig, Tipp, +1 Glas. */
  help(stage, api) {
    const sc = scene(stage);
    const row = h('div.tt-tools');
    const mk = (ic, label) => {
      const b = h('div.tt-tool', null, h('span.ic', { html: icon(ic, { size: 22 }) }), h('span', null, label));
      row.append(b);
      return b;
    };
    const tools = [mk('undo', 'Zurück'), mk('hint', 'Tipp'), mk('plus', '+1 Glas')];
    sc.append(row);
    return api.loop(async () => {
      for (const t of tools) {
        await api.finger.tap(t, 520);
        t.classList.remove('hit'); void t.offsetWidth; t.classList.add('hit');
        await api.sleep(380);
      }
      api.finger.hide();
      await api.sleep(700);
    }, 300);
  },
};

/** Schritte für showTutorial aus den Texten in data/texts.js. */
export function tutorialSteps(howTo) {
  return howTo.map((s) => ({
    title: s.title,
    text: s.text,
    demo: DEMOS[s.demo] || undefined,
  }));
}

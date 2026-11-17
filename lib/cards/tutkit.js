// Bausteine für animierte Tutorial-Szenen der Spalten-Patiencen (Mini-Karten 50 × 70 px).
//
//   const { scene } = tutStage(stage, { w: 300, hgt: 200 });
//   const a = pile(scene, 20, 10, [codes…], { down: 2 });     // Spalte, 2 verdeckt
//   await api.finger.tap(peek(stage, a[3]));                    // auf den sichtbaren Rand tippen
//   moveGroup(a.slice(3), 120, 40);  flip(a[1]);  home(a);      // bewegen, aufdecken, zurück
import { h, icon } from '../../shared/ui.js';
import { miniCard, moveMini } from './shell.js';

export const STEP = 22;

/** Spalte aus Mini-Karten (codes von unten nach oben), die ersten `down` verdeckt. */
export function pile(scene, x, y, codes, { down = 0, step = STEP, dstep = 9, z = 10 } = {}) {
  const els = [];
  let yy = y;
  codes.forEach((code, i) => {
    const up = i >= down;
    const el = miniCard(code, { x, y: yy, up });
    el.style.zIndex = z + i;
    el._home = { x, y: yy, z: z + i, up };
    scene.append(el);
    els.push(el);
    yy += i < down ? dstep : step;
  });
  return els;
}

/** Alle Karten zurück an ihren Anfangsplatz. */
export function home(els) {
  els.forEach((e) => {
    moveMini(e, e._home.x, e._home.y);
    e.style.zIndex = e._home.z;
    e.classList.toggle('up', e._home.up);
    e.classList.remove('gone', 'hint');
  });
}

/** Gruppe (unten → oben) an eine neue Stelle legen. */
export function moveGroup(els, x, y, { step = STEP, z = 40 } = {}) {
  els.forEach((e, i) => {
    moveMini(e, x, y + i * step);
    e.style.zIndex = z + i;
  });
}

/** Karte umdrehen (mit kleinem Hüpfer). */
export function flip(el, up = true) {
  el.classList.toggle('up', up);
  const pin = el.firstChild;
  pin.classList.remove('pop');
  void pin.offsetWidth;
  pin.classList.add('pop');
}

/** Platzhalter (leere Spalte / Ablage) in der Szene. */
export function tslot(scene, x, y, html = '', solid = false) {
  const s = h('div.pt-tslot' + (solid ? '.solid' : ''), { html });
  s.style.left = x + 'px';
  s.style.top = y + 'px';
  scene.append(s);
  return s;
}

/** Werkzeug-Knopf (Tipp, Zurück …) in der Szene. */
export function tool(scene, x, y, iconName, text) {
  const b = h('div.pt-tool', { html: icon(iconName, { size: 20 }) });
  b.append(h('span', null, text));
  b.style.left = x + 'px';
  b.style.top = y + 'px';
  scene.append(b);
  return b;
}

/** Beschriftung unten in der Bühne. */
export function label(scene, text) {
  const l = h('div.pc-label.off', null, text);
  scene.parentNode.append(l);
  return {
    el: l,
    show(t) { if (t) l.textContent = t; l.classList.remove('off'); },
    hide() { l.classList.add('off'); },
  };
}

/** Punkt (in % der Bühne) auf dem sichtbaren oberen Rand einer Karte – für api.finger. */
export function peek(stage, el, fy = 0.16) {
  const s = stage.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  if (!s.width || !s.height) return { x: 50, y: 50 };
  return { x: ((r.left + r.width * 0.55 - s.left) / s.width) * 100, y: ((r.top + r.height * fy - s.top) / s.height) * 100 };
}

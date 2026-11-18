// Dreierlei – kleine gemeinsame Bausteine für Spiel, Menü und Anleitung.

import { h, icon } from '../shared/ui.js';
import { L } from '../shared/i18n.js';

export const ACCENT = '#8a63d2';

export const STASH_ICON = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 13.5h16v6a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19.5z"/><path d="M9 17h6"/><path d="M12 3.5v7M8.8 6.7L12 3.5l3.2 3.2"/></svg>';

/** Die vier Hilfen: Beschriftung und Symbol (Spiel und Anleitung zeigen dieselben Knöpfe). */
export const HELPER_INFO = {
  undo: { label: () => L('Zurück', 'Undo'), icon: () => icon('undo') },
  stash: { label: () => L('Auslagern', 'Set aside'), icon: () => STASH_ICON },
  shuffle: { label: () => L('Mischen', 'Shuffle'), icon: () => icon('shuffle') },
  hint: { label: () => L('Tipp', 'Hint'), icon: () => icon('hint') },
};

/** Ein Spielstein (wie im Spiel), z.B. für Vorschauen und Anleitung. */
export function miniTile(emoji, cls = '') {
  return h('div.tr-tile.static' + (cls ? '.' + cls : ''), null, h('span.tr-emo', null, emoji));
}

/** Kleine Funken (Spielstil) an Position x/y – Einheit frei wählbar ('px' im Spiel, '%' in der Anleitung). */
export function sparkBurst(parent, x, y, colors, { n = 12, dist = 34, unit = 'px' } = {}) {
  for (let k = 0; k < n; k++) {
    const a = (k / n) * Math.PI * 2 + Math.random() * 0.4;
    const d = dist + Math.random() * dist * 0.9;
    const star = k % 3 === 0;
    const el = h('span.tr-spark' + (star ? '.star' : ''));
    el.style.left = x + unit;
    el.style.top = y + unit;
    if (star) { el.innerHTML = icon('sparkle', { size: 16 }); el.style.color = colors[k % colors.length]; } else el.style.background = colors[k % colors.length];
    parent.append(el);
    const anim = el.animate([
      { transform: 'translate(-50%,-50%) scale(.4)', opacity: 1 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d}px), calc(-50% + ${Math.sin(a) * d}px)) scale(1)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${Math.cos(a) * d * 1.25}px), calc(-50% + ${Math.sin(a) * d * 1.25 + 10}px)) scale(.6)`, opacity: 0 },
    ], { duration: 620 + Math.random() * 200, easing: 'cubic-bezier(.2,.8,.3,1)' });
    anim.onfinish = () => el.remove();
  }
}

/** Schwebender Lobtext («Super!») an Position x/y. */
export function floatText(parent, text, x, y, { big = false, unit = 'px' } = {}) {
  const el = h('div.tr-float' + (big ? '.big' : ''), null, text);
  el.style.left = x + unit;
  el.style.top = y + unit;
  parent.append(el);
  el.animate([
    { transform: 'translate(-50%,-20%) scale(.6)', opacity: 0 },
    { transform: 'translate(-50%,-70%) scale(1.08)', opacity: 1, offset: 0.25 },
    { transform: 'translate(-50%,-90%) scale(1)', opacity: 1, offset: 0.7 },
    { transform: 'translate(-50%,-140%) scale(.96)', opacity: 0 },
  ], { duration: big ? 1500 : 1000, easing: 'ease-out' }).onfinish = () => el.remove();
}

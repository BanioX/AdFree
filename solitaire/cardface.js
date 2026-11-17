// Kartengesichter: Farbsymbole (SVG-Sprite), Werte, eigene Bildkarten-Illustrationen.
import { suitOf, rankOf } from './logic/rules.js';

export const SUIT_NAMES = ['Pik', 'Herz', 'Kreuz', 'Karo'];

const SUIT_SYMBOLS = [
  // Pik
  '<path d="M12 1.8C9.6 5.6 3.2 9.3 3.2 14.1a4.6 4.6 0 0 0 7.7 3.4L9.6 22h4.8l-1.3-4.5a4.6 4.6 0 0 0 7.7-3.4C20.8 9.3 14.4 5.6 12 1.8z"/>',
  // Herz
  '<path d="M12 21.4S2.8 15.5 2.8 9.2C2.8 5.9 5.2 3.6 8.1 3.6c1.7 0 3.1.9 3.9 2.2.8-1.3 2.2-2.2 3.9-2.2 2.9 0 5.3 2.3 5.3 5.6 0 6.3-9.2 12.2-9.2 12.2z"/>',
  // Kreuz
  '<circle cx="12" cy="6.6" r="4.4"/><circle cx="6.6" cy="13.4" r="4.4"/><circle cx="17.4" cy="13.4" r="4.4"/><circle cx="12" cy="12" r="2.6"/><path d="M12 11.5 9.4 22h5.2z"/>',
  // Karo
  '<path d="M12 1.6C14.6 6 17.3 9 20.6 12 17.3 15 14.6 18 12 22.4 9.4 18 6.7 15 3.4 12 6.7 9 9.4 6 12 1.6z"/>',
];

/** Einmal pro Dokument: SVG-Sprite mit den vier Farbsymbolen. */
export function installSprite() {
  if (document.getElementById('sol-sprite')) return;
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.id = 'sol-sprite';
  svg.setAttribute('aria-hidden', 'true');
  svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  svg.innerHTML = SUIT_SYMBOLS.map((p, i) => `<symbol id="su${i}" viewBox="0 0 24 24">${p}</symbol>`).join('');
  document.body.prepend(svg);
}

export const suitSVG = (s, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" aria-hidden="true"><use href="#su${s}"/></svg>`;

export function rankLabel(r, labels = 'BDK') {
  if (r === 1) return 'A';
  if (r <= 10) return String(r);
  const set = labels === 'JQK' ? ['J', 'Q', 'K'] : ['B', 'D', 'K'];
  return set[r - 11];
}

// ---------------------------------------------------------------- Bildkarten (eigene Zeichnungen)
// viewBox 0 0 40 44. "currentColor" = Farbe der Kartenfarbe (rot/schwarz/…)

const SKIN = '#f7d6bb';
const CHEEK = '#f3a0a0';
const GOLD = '#f2c14e';
const GOLD_D = '#b98a2a';
const INK = '#3a2a2a';

const face = (cx, cy) => `<circle cx="${cx}" cy="${cy}" r="7.2" fill="${SKIN}"/>`
  + `<circle cx="${cx - 2.7}" cy="${cy - .4}" r=".95" fill="${INK}"/><circle cx="${cx + 2.7}" cy="${cy - .4}" r=".95" fill="${INK}"/>`
  + `<circle cx="${cx - 4}" cy="${cy + 2.2}" r="1.5" fill="${CHEEK}" opacity=".55"/><circle cx="${cx + 4}" cy="${cy + 2.2}" r="1.5" fill="${CHEEK}" opacity=".55"/>`;

const HAIR = ['#5b3a24', '#b8662f', '#3d2b22', '#d39a3c'];

function king(s) {
  return `<svg class="court" viewBox="0 0 40 44" aria-hidden="true">`
    + `<path d="M3.5 44C3.5 33.5 10.5 28.5 20 28.5S36.5 33.5 36.5 44Z" fill="currentColor"/>`
    + `<path d="M9 31.5Q20 37 31 31.5L29.5 29Q20 33.5 10.5 29Z" fill="#fff"/>`
    + `<circle cx="14" cy="31.6" r=".7" fill="${INK}"/><circle cx="20" cy="33.1" r=".7" fill="${INK}"/><circle cx="26" cy="31.6" r=".7" fill="${INK}"/>`
    + `<path d="M17 36h6v8h-6z" fill="${GOLD}" opacity=".9"/>`
    + face(20, 20.5)
    + `<path d="M12.9 21.5Q13.4 30.5 20 31.3Q26.6 30.5 27.1 21.5Q24.6 26.3 20 26.3Q15.4 26.3 12.9 21.5Z" fill="${HAIR[s]}"/>`
    + `<path d="M16.6 24.6Q20 23 23.4 24.6Q20 26 16.6 24.6Z" fill="${HAIR[s]}"/>`
    + `<path d="M12 14.6L12.6 6.6 16.3 10.8 20 4.6 23.7 10.8 27.4 6.6 28 14.6Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".8" stroke-linejoin="round"/>`
    + `<circle cx="20" cy="11.6" r="1.4" fill="currentColor"/><circle cx="12.6" cy="6.4" r=".9" fill="${GOLD}"/><circle cx="27.4" cy="6.4" r=".9" fill="${GOLD}"/><circle cx="20" cy="4.4" r="1" fill="${GOLD}"/>`
    + `</svg>`;
}

function queen(s) {
  return `<svg class="court" viewBox="0 0 40 44" aria-hidden="true">`
    + `<path d="M11.2 20Q10 9.5 20 9.5T28.8 20L30.6 33Q20 36 9.4 33Z" fill="${HAIR[(s + 1) % 4]}"/>`
    + `<path d="M3.5 44C3.5 33.5 10.5 29 20 29S36.5 33.5 36.5 44Z" fill="currentColor"/>`
    + `<path d="M14.5 29.6L20 37.5 25.5 29.6Q20 31.4 14.5 29.6Z" fill="${SKIN}"/>`
    + `<path d="M14.8 31Q20 36.4 25.2 31" fill="none" stroke="#fff" stroke-width="1.3" stroke-dasharray=".2 1.9" stroke-linecap="round"/>`
    + face(20, 20.5)
    + `<path d="M12.8 18.6Q13.6 11.8 20 11.8T27.2 18.6Q24 14.6 20 15.6Q16 14.6 12.8 18.6Z" fill="${HAIR[(s + 1) % 4]}"/>`
    + `<path d="M18.3 24.3Q20 25.5 21.7 24.3" fill="none" stroke="${INK}" stroke-width=".8" stroke-linecap="round"/>`
    + `<path d="M14.2 13.4L15.6 8.6 17.8 11.4 20 7 22.2 11.4 24.4 8.6 25.8 13.4Q20 11.2 14.2 13.4Z" fill="${GOLD}" stroke="${GOLD_D}" stroke-width=".7" stroke-linejoin="round"/>`
    + `<circle cx="20" cy="10.8" r="1.1" fill="currentColor"/>`
    + `</svg>`;
}

function jack(s) {
  return `<svg class="court" viewBox="0 0 40 44" aria-hidden="true">`
    + `<path d="M3.5 44C3.5 33.5 10.5 29 20 29S36.5 33.5 36.5 44Z" fill="currentColor"/>`
    + `<path d="M12 30.8L20 35.8 28 30.8 26.8 29Q20 32 13.2 29Z" fill="#fff"/>`
    + `<path d="M20 35.8V44" stroke="#fff" stroke-width="1.2" opacity=".7"/>`
    + face(20, 21)
    + `<path d="M12.9 20Q13.6 15 20 15T27.1 20Q24.5 17.6 20 18.2Q15.5 17.6 12.9 20Z" fill="${HAIR[(s + 2) % 4]}"/>`
    + `<path d="M18.4 24.6Q20 25.9 21.6 24.6" fill="none" stroke="${INK}" stroke-width=".8" stroke-linecap="round"/>`
    + `<path d="M10.5 16.2Q11 8.8 20 8.6Q29.4 8.8 29.6 15.4Q20 13.2 10.5 16.2Z" fill="currentColor"/>`
    + `<path d="M10.5 16.2Q20 13 29.6 15.4L29.8 16.9Q20 14.8 10.4 17.8Z" fill="${GOLD}"/>`
    + `<path d="M25.5 10.4Q32 3 36.4 4.6Q33.4 6.4 31.4 9.8Q29 12.6 26.4 12.2Z" fill="#fff" stroke="${GOLD_D}" stroke-width=".5"/>`
    + `<path d="M26.8 11.4Q31 7.4 35 5.2" fill="none" stroke="${GOLD_D}" stroke-width=".6"/>`
    + `</svg>`;
}

/**
 * HTML für die Vorderseite einer Karte.
 * opts: { labels: 'BDK'|'JQK', compact: bool }
 */
export function faceHTML(code, opts = {}) {
  const s = suitOf(code);
  const r = rankOf(code);
  const label = rankLabel(r, opts.labels);
  let art;
  if (r >= 11) {
    const fn = r === 11 ? jack : r === 12 ? queen : king;
    art = `<div class="art court-bg">${fn(s)}</div>`;
  } else if (r === 1) {
    art = `<div class="art ace">${suitSVG(s, 'big')}</div>`;
  } else {
    art = `<div class="art">${suitSVG(s, 'big')}</div>`;
  }
  return `<div class="face s${s}${label.length > 1 ? ' wide' : ''}"><span class="rk">${label}</span>${suitSVG(s, 'si')}${art}</div>`;
}

export function cardName(code, labels) {
  const r = rankOf(code);
  const names = { 1: 'Ass', 11: labels === 'JQK' ? 'Bube' : 'Bube', 12: 'Dame', 13: 'König' };
  return `${SUIT_NAMES[suitOf(code)]} ${names[r] || r}`;
}

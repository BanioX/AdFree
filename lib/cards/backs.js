// Kartenrücken der Patience-Familie (angepasst aus /solitaire/data/backs.js).
// Jeder Eintrag: { id, name, bg, fg, frame, pattern, medallion? } – Muster siehe PATTERNS unten.
// Neue Rücken: einfach einen Eintrag ergänzen.

export const BACKS = [
  { id: 'rubin', name: 'Rubin', bg: '#c33a4c', fg: '#f7c3cb', frame: '#fff8f2', pattern: 'lattice', medallion: true },
  { id: 'ozean', name: 'Ozean', bg: '#2f6db5', fg: '#a9d0fb', frame: '#f4f9ff', pattern: 'waves' },
  { id: 'salbei', name: 'Salbei', bg: '#4c8b67', fg: '#c4e8cf', frame: '#f6fbf4', pattern: 'leaves' },
  { id: 'rose', name: 'Rosé', bg: '#e48a9c', fg: '#fff0f3', frame: '#fffafa', pattern: 'scallops' },
  { id: 'nacht', name: 'Sternbild', bg: '#25325a', fg: '#f4cd5e', frame: '#f8f3e6', pattern: 'stars', medallion: true },
  { id: 'lavendel', name: 'Lavendel', bg: '#8a72c4', fg: '#e9e0ff', frame: '#fbf9ff', pattern: 'dots' },
  { id: 'sonne', name: 'Sonne', bg: '#e39a2d', fg: '#f9d57e', frame: '#fffaf0', pattern: 'sunburst' },
  { id: 'kirsch', name: 'Kirschblüte', bg: '#fbe9ec', fg: '#ec8fa6', frame: '#ffffff', pattern: 'blossoms' },
  { id: 'mosaik', name: 'Mosaik', bg: '#1f8585', fg: '#8fdcd0', frame: '#f2fbfa', pattern: 'triangles' },
  { id: 'karo', name: 'Schotten', bg: '#2c4c78', fg: '#d9474f', frame: '#fbf6ee', pattern: 'tartan' },
  { id: 'kupfer', name: 'Kupfer', bg: '#b0603a', fg: '#f3c7a6', frame: '#fff8f2', pattern: 'chevron' },
  { id: 'klee', name: 'Kleeblatt', bg: '#3e8e4f', fg: '#bfe7b4', frame: '#fbfff7', pattern: 'clover', medallion: true },
];

export const DEFAULT_BACK = 'rubin';

// Muster als SVG-Kacheln (Koordinaten im Kartenraum 0..100 × 0..140)
export const PATTERNS = {
  lattice: (b) => tile(12, 12, `<path d="M0 6L6 0L12 6L6 12Z" fill="none" stroke="${b.fg}" stroke-width="1.1" opacity=".75"/><circle cx="6" cy="6" r="1.3" fill="${b.fg}" opacity=".8"/>`),
  waves: (b) => tile(16, 10, `<path d="M0 5q4-4.5 8 0t8 0" fill="none" stroke="${b.fg}" stroke-width="1.6" opacity=".8"/>`),
  leaves: (b) => tile(18, 18, `<path d="M4 13c0-5 4-9 9-9 0 5-4 9-9 9z" fill="${b.fg}" opacity=".55"/><path d="M4 13l9-9" stroke="${b.bg}" stroke-width=".8"/><circle cx="14" cy="14" r="1.4" fill="${b.fg}" opacity=".7"/>`),
  scallops: (b) => tile(14, 8, `<path d="M0 8a7 7 0 0 1 14 0" fill="none" stroke="${b.fg}" stroke-width="1.4" opacity=".85"/><circle cx="7" cy="4.5" r="1" fill="${b.fg}"/>`),
  stars: (b) => tile(22, 22, `${star(6, 6, 2.6, b.fg)}${star(17, 15, 1.8, b.fg)}<circle cx="15" cy="5" r=".7" fill="${b.fg}" opacity=".7"/><circle cx="5" cy="17" r=".6" fill="${b.fg}" opacity=".6"/>`),
  dots: (b) => tile(10, 10, `<circle cx="2.5" cy="2.5" r="1.6" fill="${b.fg}" opacity=".85"/><circle cx="7.5" cy="7.5" r="1.6" fill="${b.fg}" opacity=".85"/>`),
  sunburst: (b) => {
    let s = '';
    for (let i = 0; i < 24; i += 2) {
      const a0 = (i / 24) * Math.PI * 2, a1 = ((i + 1) / 24) * Math.PI * 2;
      s += `<path d="M50 70L${(50 + 120 * Math.cos(a0)).toFixed(1)} ${(70 + 120 * Math.sin(a0)).toFixed(1)}L${(50 + 120 * Math.cos(a1)).toFixed(1)} ${(70 + 120 * Math.sin(a1)).toFixed(1)}Z" fill="${b.fg}" opacity=".55"/>`;
    }
    return { body: s + `<circle cx="50" cy="70" r="12" fill="${b.fg}"/><circle cx="50" cy="70" r="7" fill="${b.bg}"/>` };
  },
  blossoms: (b) => tile(24, 24, `${blossom(7, 7, 3.2, b.fg)}${blossom(19, 18, 2.4, b.fg)}<circle cx="18" cy="5" r=".9" fill="${b.fg}" opacity=".6"/>`),
  triangles: (b) => tile(14, 12, `<path d="M0 12L7 0L14 12Z" fill="${b.fg}" opacity=".45"/><path d="M7 12L10.5 6L14 12Z" fill="${b.fg}" opacity=".5"/>`),
  tartan: (b) => tile(20, 20, `<rect x="0" y="7" width="20" height="6" fill="${b.fg}" opacity=".55"/><rect x="7" y="0" width="6" height="20" fill="${b.fg}" opacity=".45"/><rect x="0" y="9.4" width="20" height="1.2" fill="#fff4d6" opacity=".7"/><rect x="9.4" y="0" width="1.2" height="20" fill="#fff4d6" opacity=".7"/><rect x="0" y="0" width="20" height="1" fill="#000" opacity=".15"/>`),
  chevron: (b) => tile(14, 10, `<path d="M0 8l7-6 7 6" fill="none" stroke="${b.fg}" stroke-width="1.6" opacity=".8"/>`),
  clover: (b) => tile(20, 20, `${clover(10, 10, 2.4, b.fg)}<circle cx="0" cy="0" r="1" fill="${b.fg}" opacity=".6"/><circle cx="20" cy="20" r="1" fill="${b.fg}" opacity=".6"/>`),
};

function tile(w, h, body) { return { w, h, body }; }

function star(cx, cy, r, c) {
  const p = [];
  for (let i = 0; i < 8; i++) {
    const rr = i % 2 ? r * 0.38 : r;
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    p.push(`${(cx + rr * Math.cos(a)).toFixed(2)} ${(cy + rr * Math.sin(a)).toFixed(2)}`);
  }
  return `<path d="M${p.join('L')}Z" fill="${c}"/>`;
}

function blossom(cx, cy, r, c) {
  let s = '';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
    s += `<circle cx="${(cx + r * Math.cos(a)).toFixed(2)}" cy="${(cy + r * Math.sin(a)).toFixed(2)}" r="${(r * 0.72).toFixed(2)}" fill="${c}" opacity=".85"/>`;
  }
  return s + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.45).toFixed(2)}" fill="#f6c453"/>`;
}

function clover(cx, cy, r, c) {
  let s = '';
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    s += `<circle cx="${(cx + r * Math.cos(a)).toFixed(2)}" cy="${(cy + r * Math.sin(a)).toFixed(2)}" r="${(r * 0.85).toFixed(2)}" fill="${c}" opacity=".7"/>`;
  }
  return s;
}

/** Komplettes SVG eines Kartenrückens (Kartenraum 100 × 140). */
export function backSVG(b) {
  if (b.svg) return b.svg;
  const pat = (PATTERNS[b.pattern] || PATTERNS.dots)(b);
  let fill;
  let defs = `<clipPath id="c"><rect x="5" y="5" width="90" height="130" rx="7"/></clipPath>`;
  if (pat.w) {
    defs += `<pattern id="p" width="${pat.w}" height="${pat.h}" patternUnits="userSpaceOnUse">${pat.body}</pattern>`;
    fill = `<rect x="5" y="5" width="90" height="130" fill="url(#p)"/>`;
  } else {
    fill = pat.body;
  }
  const med = b.medallion
    ? `<ellipse cx="50" cy="70" rx="17" ry="21" fill="${b.bg}" stroke="${b.fg}" stroke-width="2"/><ellipse cx="50" cy="70" rx="11" ry="14" fill="none" stroke="${b.fg}" stroke-width="1.2" opacity=".8"/><path d="M50 60l3.5 10L50 80l-3.5-10z" fill="${b.fg}"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 140" preserveAspectRatio="none"><defs>${defs}</defs>`
    + `<rect width="100" height="140" rx="10" fill="${b.frame}"/>`
    + `<rect x="5" y="5" width="90" height="130" rx="7" fill="${b.bg}"/>`
    + `<g clip-path="url(#c)">${fill}${med}</g>`
    + `<rect x="8" y="8" width="84" height="124" rx="5" fill="none" stroke="${b.frame}" stroke-width="1.2" opacity=".55"/>`
    + `</svg>`;
}

export function backDataURL(b) {
  return `url("data:image/svg+xml,${encodeURIComponent(backSVG(b))}")`;
}

// Zeichnet das Kachel-Icon /icons/games/jigsaw.svg aus echten Puzzleteil-Formen: node jigsaw/tests/make-icon.mjs icons/games/jigsaw.svg
import { makeGeometry } from '../logic.js';
import { writeFileSync } from 'node:fs';
const geo = makeGeometry({ cols: 2, rows: 2, seed: 5, aspect: 1 });
const E = (s, extra = {}) => ({ s, t: 0.1, a: 0, b: 0, c: 0, d: 0, e: 0, ...extra });
geo.edges.v[0][1] = E(1, { b: 0.0 });   // TL -> Nase nach rechts in TR
geo.edges.v[1][1] = E(-1);              // BR -> Nase nach links in BL
geo.edges.h[1][0] = E(-1);              // BL -> Nase nach oben in TL
geo.edges.h[1][1] = E(1);               // TR -> Nase nach unten in BR
const P = [0, 1, 2, 3].map((i) => geo.piecePath(i));
const org = (i) => [(i % 2) * 500, Math.floor(i / 2) * 500];
const S = 0.064, X = 11, Y = 29;     // Brett 56 x 56 px
const sw = (px) => +(px / S).toFixed(1);
const pic = `<rect width="1000" height="1000" fill="url(#sky)"/>
<circle cx="735" cy="270" r="135" fill="#ffe08a"/><circle cx="735" cy="270" r="190" fill="#fff3c4" opacity=".45"/>
<path d="M120 300c20-60 120-70 150-20 50-20 110 10 100 60H130c-50 0-50-40-10-40z" fill="#fff"/>
<path d="M0 560C170 430 360 450 520 560S820 470 1000 520V1000H0Z" fill="#9bd08f"/>
<path d="M0 720C250 620 560 660 1000 660V1000H0Z" fill="#62ad6e"/>
<circle cx="200" cy="830" r="34" fill="#ff8fa3"/><circle cx="200" cy="830" r="12" fill="#ffd23f"/>
<circle cx="430" cy="880" r="30" fill="#fff"/><circle cx="430" cy="880" r="11" fill="#ffd23f"/>
<circle cx="680" cy="820" r="34" fill="#ff8fa3"/><circle cx="680" cy="820" r="12" fill="#ffd23f"/>
<circle cx="860" cy="900" r="28" fill="#fff"/><circle cx="860" cy="900" r="10" fill="#ffd23f"/>`;
const piece = (i, extra = '') => {
  const [ox, oy] = org(i);
  return `<g${extra}><clipPath id="c${i}"><path transform="translate(${ox} ${oy})" d="${P[i]}"/></clipPath>
<g clip-path="url(#c${i})"><use href="#pic"/></g>
<path transform="translate(${ox} ${oy})" d="${P[i]}" fill="none" stroke="#4a3418" stroke-width="${sw(2.4)}" stroke-linejoin="round"/></g>`;
};
const [lx, ly] = org(1);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fdf1e4"/><stop offset="1" stop-color="#eccaa9"/></linearGradient>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7cc6ef"/><stop offset=".6" stop-color="#cdeefb"/></linearGradient>
<g id="pic">${pic}</g></defs>
<rect width="100" height="100" fill="url(#bg)"/>
<ellipse cx="45" cy="93" rx="35" ry="4.5" fill="#9a6b4f" opacity=".2"/>
<g transform="translate(${X} ${Y}) scale(${S})">
<path transform="translate(${lx} ${ly})" d="${P[1]}" fill="#cf9e78" stroke="#4a3418" stroke-opacity=".3" stroke-width="${sw(1.6)}" stroke-linejoin="round"/>
${piece(0)}${piece(2)}${piece(3)}
<g transform="translate(250 -235) rotate(11 750 250)"><path transform="translate(${lx + 60} ${ly + 100})" d="${P[1]}" fill="#6b4524" opacity=".28"/>${piece(1)}</g>
</g>
<path d="M90 40l1.6 4.4 4.4 1.6-4.4 1.6-1.6 4.4-1.6-4.4-4.4-1.6 4.4-1.6z" fill="#fff" stroke="#4a3418" stroke-width="1.2" stroke-linejoin="round"/>
<path d="M24 12l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1z" fill="#fff" stroke="#4a3418" stroke-width="1" stroke-linejoin="round"/>
</svg>
`;
writeFileSync(process.argv[2], svg.replace(/(\d+\.\d{2})\d+/g, '$1'));

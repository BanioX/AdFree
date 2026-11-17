// Prüft die Wortlisten von Wortrate (wordle/data/*.js).
//   node wordle/tools/check-words.mjs        → Bericht, Exit-Code 1 bei Fehlern
// Die Tests (wordle/tests/content.test.mjs) verwenden dieselbe Prüfung.

import { parseWordList, normalizeWord, isWordShape } from '../logic.js';

export const FILES = [
  { len: 4, answers: 'answers4.js', allowed: 'allowed4.js', minAnswers: 300 },
  { len: 5, answers: 'answers.js', allowed: 'allowed.js', minAnswers: 1500 },
  { len: 6, answers: 'answers6.js', allowed: 'allowed6.js', minAnswers: 1000 },
];

// Wörter, die nie Lösungswort sein dürfen (unfreundlich, derb, traurig). Gilt für alle Längen.
export const BLOCKED = new Set(`
  HURE NUTTE FOTZE FICKT FICKE FICKEN ARSCH KOTZE KOTZEN PENIS BUSEN NAZI NAZIS MORD MORDE MORDEN
  LEICHE DROGE DROGEN KOKS HEROIN TITTE TITTEN WICHS PISSE PISSEN KACKE HODEN SPERMA VAGINA GEIL
  IDIOT IDIOTEN DEPP DEPPEN TÖTEN TÖTET BOMBE BOMBEN SUFF SAUFEN SAUFT HASS HASSEN NEGER TOD TOTE
  SCHEISS MIST LUDER SCHLAMPE FOLTER KRIEG LEICHEN WAFFE WAFFEN
`.split(/\s+/).filter(Boolean));

/** Rohe Wörter (ohne Kommentare) einer Liste, normalisiert, in Originalreihenfolge (mit Doppelten). */
export function rawTokens(text) {
  const out = [];
  for (const line of String(text).split('\n')) {
    for (const raw of line.replace(/\/\/.*$/, '').split(/[\s,;]+/)) if (raw) out.push({ raw, w: normalizeWord(raw) });
  }
  return out;
}

async function load(file) {
  return (await import(new URL(`../data/${file}`, import.meta.url))).default;
}

/** Prüft alle Listen. → { errors: string[], warnings: string[], info: string[] } */
export async function checkAll() {
  const errors = [];
  const warnings = [];
  const info = [];
  for (const f of FILES) {
    const aText = await load(f.answers);
    const bText = await load(f.allowed);
    for (const [name, text] of [[f.answers, aText], [f.allowed, bText]]) {
      const seen = new Set();
      for (const { raw, w } of rawTokens(text)) {
        if (/ß/.test(raw)) errors.push(`${name}: «${raw}» enthält ß – bitte «ss» schreiben`);
        if (!isWordShape(w, f.len)) errors.push(`${name}: «${raw}» hat nicht genau ${f.len} Buchstaben (A–Z, Ä, Ö, Ü)`);
        if (seen.has(w)) warnings.push(`${name}: «${w}» kommt doppelt vor`);
        seen.add(w);
      }
    }
    const answers = parseWordList(aText, f.len);
    const allowed = new Set(parseWordList(bText, f.len));
    if (answers.length < f.minAnswers) errors.push(`${f.answers}: nur ${answers.length} Lösungswörter (mindestens ${f.minAnswers})`);
    for (const w of answers) {
      if (BLOCKED.has(w)) errors.push(`${f.answers}: «${w}» ist als Lösungswort nicht erlaubt`);
      if (!allowed.has(w)) warnings.push(`${f.allowed}: Lösungswort «${w}» fehlt (wird automatisch ergänzt)`);
    }
    info.push(`${f.len} Buchstaben: ${answers.length} Lösungswörter, ${new Set([...allowed, ...answers]).size} erlaubte Wörter`);
  }
  return { errors, warnings, info };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { errors, warnings, info } = await checkAll();
  for (const l of info) console.log('✓ ' + l);
  for (const l of warnings) console.log('! ' + l);
  for (const l of errors) console.log('✗ ' + l);
  console.log(errors.length ? `\n${errors.length} Fehler.` : '\nAlles in Ordnung.');
  process.exit(errors.length ? 1 : 0);
}

// Tagesrätsel: für alle gleich, jeden Tag neu (Seed aus dem Datum). Ohne DOM – auch in Tests nutzbar.

import { makeRng } from '../shared/rng.js';
import { layouts } from './data/layouts.js';
import { parseLayout, generateLayoutDef } from './engine.js';

/** Layout-Definition des Tagesrätsels für ein Datum ('YYYY-MM-DD'). */
export function dailyDef(date) {
  const rng = makeRng('mahjong-tag-' + date);
  if (rng.next() < 0.3) {
    const def = generateLayoutDef('tag-' + date, rng.chance(0.5) ? 'mittel' : 'gross');
    return { ...def, name: 'Tagesform' };
  }
  const pool = layouts.filter((l) => parseLayout(l).tiles.length >= 64);
  return rng.pick(pool);
}

/** Seed für die Steinverteilung des Tagesrätsels. */
export const dailySeed = (date) => 'mahjong-' + date;

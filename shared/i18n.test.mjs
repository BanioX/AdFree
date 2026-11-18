import assert from 'node:assert/strict';
import { L, fmt, plural, dict } from './i18n.js';

assert.equal(L('Hallo', 'Hello'), 'Hallo');
assert.equal(L({ de: 'Ja', en: 'Yes' }), 'Ja');
assert.equal(fmt('Level {n}', { n: 3 }), 'Level 3');
assert.equal(plural(1, ['Sieg', 'Siege'], ['win', 'wins']), '1 Sieg');
assert.equal(plural(3, ['Sieg', 'Siege'], ['win', 'wins']), '3 Siege');

const tr = dict({
  de: { hi: 'Hallo {name}', only: 'Nur deutsch' },
  en: { hi: 'Hello {name}' },
});
assert.equal(tr('hi', { name: 'Ada' }), 'Hallo Ada');
assert.equal(tr('only'), 'Nur deutsch');
assert.equal(tr('missing'), 'missing');
console.log('i18n ok');

import { bootRetro } from '../lib/retro/boot.js';
import { bosses } from './data/bosses.js';
import { t } from './i18n.js';
import { steps } from './tutorial.js';

bootRetro({
  id: 'riesen',
  mode: 'shoot',
  accent: '#e23d8a',
  bosses,
  steps,
  t,
});

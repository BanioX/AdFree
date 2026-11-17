import { bootRetro } from '../lib/retro/boot.js';
import { bosses } from './data/bosses.js';
import { t } from './i18n.js';
import { steps } from './tutorial.js';

bootRetro({
  id: 'sternkater',
  mode: 'plat',
  accent: '#1fa971',
  bosses,
  steps,
  t,
});

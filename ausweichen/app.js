import { bootRetro } from '../lib/retro/boot.js';
import { bosses } from './data/bosses.js';
import { t } from './i18n.js';
import { steps } from './tutorial.js';

bootRetro({
  id: 'ausweichen',
  mode: 'dodge',
  accent: '#14b8c7',
  bosses,
  steps,
  t,
});

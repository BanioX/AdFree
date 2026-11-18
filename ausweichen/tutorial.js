import { t } from './i18n.js';
import { palOf, drawMech, drawShip } from '../lib/retro/draw.js';

function scene(stage) {
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 120;
  canvas.style.width = '100%';
  canvas.style.height = '140px';
  canvas.style.imageRendering = 'pixelated';
  stage.append(canvas);
  return canvas.getContext('2d');
}

export function steps() {
  const pal = palOf('magenta');
  return [
    {
      title: t('tut1'),
      text: t('tut1b'),
      demo(stage, api) {
        const ctx = scene(stage);
        return api.loop(async () => {
          const job = api.finger.drag([{ x: 30, y: 75 }, { x: 70, y: 60 }], 800);
          const t0 = performance.now();
          while (performance.now() - t0 < 900) {
            const u = Math.min(1, (performance.now() - t0) / 900);
            ctx.fillStyle = pal.bg1;
            ctx.fillRect(0, 0, 180, 120);
            drawShip(ctx, { x: 40 + u * 80, y: 90 }, u * 3, 0, 0, pal);
            await api.sleep(30);
          }
          await job;
        });
      },
    },
    {
      title: t('tut2'),
      text: t('tut2b'),
      demo(stage, api) {
        const ctx = scene(stage);
        const boss = { def: { pal: 'magenta', kind: 'lupe', core: { ox: 0, oy: 10, r: 6 } }, x: 90, y: 40, coreOpen: false, flash: 0, phase: 0 };
        return api.loop(async () => {
          for (let i = 0; i < 26; i++) {
            const live = i > 10;
            ctx.fillStyle = pal.bg0;
            ctx.fillRect(0, 0, 180, 120);
            ctx.globalAlpha = live ? 0.95 : 0.28;
            ctx.fillStyle = pal.hot;
            ctx.fillRect(30 + i * 4, 18, 10, 100);
            ctx.globalAlpha = 1;
            drawMech(ctx, boss, null, i);
            drawShip(ctx, { x: live ? 24 : 70, y: 100 }, i, 0, 0, pal);
            await api.sleep(42);
          }
        });
      },
    },
    {
      title: t('tut3'),
      text: t('tut3b'),
      demo(stage, api) {
        const ctx = scene(stage);
        return api.loop(async () => {
          for (let i = 0; i < 20; i++) {
            ctx.fillStyle = pal.bg1;
            ctx.fillRect(0, 0, 180, 120);
            ctx.fillStyle = '#1a0610';
            ctx.fillRect(10, 16, 160, 10);
            ctx.fillStyle = pal.hot;
            ctx.fillRect(12, 18, 156 * (1 - i / 20), 6);
            drawShip(ctx, { x: 90, y: 90 }, i, 0, 0, pal);
            await api.sleep(50);
          }
        });
      },
    },
  ];
}

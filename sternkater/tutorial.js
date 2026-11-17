import { t } from './i18n.js';
import { palOf, drawMech, drawHero, drawCat } from '../lib/retro/draw.js';

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
  const pal = palOf('purple');
  const boss = {
    def: { pal: 'purple', kind: 'akte', core: { ox: -8, oy: 16, r: 6 } },
    x: 140, y: 70, coreOpen: true, flash: 0, phase: 0,
  };
  return [
    {
      title: t('tut1'),
      text: t('tut1b'),
      demo(stage, api) {
        const ctx = scene(stage);
        return api.loop(async () => {
          const job = api.finger.drag([{ x: 20, y: 78 }, { x: 55, y: 78 }], 700);
          for (let i = 0; i < 16; i++) {
            ctx.fillStyle = pal.bg1;
            ctx.fillRect(0, 0, 180, 120);
            ctx.fillStyle = pal.deep;
            ctx.fillRect(0, 96, 180, 8);
            const x = 24 + i * 3;
            const y = i > 8 ? 96 - (i - 8) * 4 : 96;
            drawHero(ctx, { x, y, vx: 20, facing: 1 }, i, 0, pal);
            drawCat(ctx, { x: x - 12, y }, i, pal);
            await api.sleep(40);
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
        return api.loop(async () => {
          for (let i = 0; i < 22; i++) {
            ctx.fillStyle = pal.bg0;
            ctx.fillRect(0, 0, 180, 120);
            const live = i > 8;
            ctx.globalAlpha = live ? 0.85 : 0.25;
            ctx.fillStyle = pal.core;
            ctx.fillRect(0, 100, 120, 8);
            ctx.globalAlpha = 1;
            ctx.fillStyle = pal.mid;
            ctx.fillRect(16, 70, 40, 5);
            drawMech(ctx, boss, null, i);
            drawHero(ctx, { x: 30, y: live ? 70 : 104, vx: 0, facing: 1 }, i, 0, pal);
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
          for (let i = 0; i < 18; i++) {
            ctx.fillStyle = pal.bg1;
            ctx.fillRect(0, 0, 180, 120);
            drawMech(ctx, boss, { x: 40, y: 80 }, i);
            ctx.fillStyle = pal.hot;
            ctx.fillRect(48 + i * 4, 78, 8, 3);
            drawHero(ctx, { x: 36, y: 90, vx: 0, facing: 1 }, i, 0, pal);
            drawCat(ctx, { x: 24, y: 90 }, i, pal);
            await api.sleep(40);
          }
        });
      },
    },
  ];
}

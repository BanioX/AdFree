import { t } from './i18n.js';
import { palOf, drawMech, drawShip, drawCat } from '../lib/retro/draw.js';

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

function sky(ctx, pal) {
  ctx.fillStyle = pal.bg1;
  ctx.fillRect(0, 0, 180, 120);
}

export function steps() {
  return [
    {
      title: t('tut1'),
      text: t('tut1b'),
      demo(stage, api) {
        const ctx = scene(stage);
        const pal = palOf('magenta');
        let x = 40;
        return api.loop(async () => {
          const job = api.finger.drag([{ x: 22, y: 72 }, { x: 78, y: 72 }], 900);
          const t0 = performance.now();
          while (performance.now() - t0 < 1000) {
            const u = Math.min(1, (performance.now() - t0) / 1000);
            x = 40 + u * 90;
            sky(ctx, pal);
            drawShip(ctx, { x, y: 78 }, u * 4, 0, 0.1, pal);
            drawCat(ctx, { x: x - 12, y: 86 }, u * 4, pal);
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
        const pal = palOf('magenta');
        const boss = { def: { pal: 'magenta', kind: 'glut', core: { ox: 0, oy: 20, r: 8 } }, x: 90, y: 46, coreOpen: true, flash: 0, phase: 0 };
        return api.loop(async () => {
          for (let i = 0; i < 28; i++) {
            const u = i / 28;
            const live = u > 0.35;
            sky(ctx, pal);
            ctx.globalAlpha = live ? 0.9 : 0.3;
            ctx.fillStyle = pal.hot;
            const bx = 20 + u * 140;
            ctx.fillRect(bx, 20, 8, 90);
            ctx.globalAlpha = 1;
            drawMech(ctx, boss, { x: bx, y: 100 }, u * 3);
            const sx = live ? (bx > 90 ? 40 : 140) : 90;
            drawShip(ctx, { x: sx, y: 100 }, u * 4, 0, 0, pal);
            await api.sleep(40);
          }
        });
      },
    },
    {
      title: t('tut3'),
      text: t('tut3b'),
      demo(stage, api) {
        const ctx = scene(stage);
        const pal = palOf('cyan');
        const boss = { def: { pal: 'cyan', kind: 'dock', core: { ox: 0, oy: 8, r: 8 } }, x: 90, y: 48, coreOpen: true, flash: 0, phase: 0 };
        return api.loop(async () => {
          for (let i = 0; i < 24; i++) {
            sky(ctx, pal);
            if (i % 8 === 4) boss.flash = 0.2;
            else boss.flash = 0;
            drawMech(ctx, boss, { x: 90, y: 100 }, i);
            ctx.fillStyle = pal.hot;
            ctx.fillRect(88, 90 - i * 3, 3, 8);
            drawShip(ctx, { x: 90, y: 104 }, i, 0, 1, pal);
            await api.sleep(40);
          }
        });
      },
    },
    {
      title: t('tut4'),
      text: t('tut4b'),
      demo(stage, api) {
        const ctx = scene(stage);
        const kinds = ['glut', 'dock', 'kiel', 'krone'];
        const pals = ['magenta', 'cyan', 'teal', 'purple'];
        return api.loop(async () => {
          for (let i = 0; i < 4; i++) {
            const pal = palOf(pals[i]);
            sky(ctx, pal);
            drawMech(ctx, {
              def: { pal: pals[i], kind: kinds[i], core: { ox: 0, oy: 8, r: 8 } },
              x: 90, y: 58, coreOpen: true, flash: 0, phase: 0,
            }, { x: 90, y: 110 }, i);
            await api.sleep(420);
          }
        });
      },
    },
  ];
}

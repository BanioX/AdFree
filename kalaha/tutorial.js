import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const row = h('div.row');
        const pits = [4, 4, 4, 4].map((n) => h('i', null, String(n)));
        row.append(...pits);
        stage.append(h('div.ka-demo', null, row));
        return api.loop(async () => {
          pits.forEach((p, i) => { p.textContent = '4'; p.classList.remove('on'); });
          await api.finger.tap(pits[0], 420);
          pits[0].textContent = '0';
          pits[0].classList.add('on');
          for (let i = 1; i <= 3; i++) {
            pits[i].textContent = '5';
            await api.sleep(180);
          }
          await api.sleep(600);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const store = h('i', null, '0');
        store.style.width = '46px';
        store.style.height = '72px';
        store.style.borderRadius = '24px';
        const row = h('div.row', null, h('i', null, '1'), h('i', null, '2'), h('i', null, '3'), store);
        stage.append(h('div.ka-demo', null, row));
        return api.loop(async () => {
          store.textContent = '0';
          store.classList.remove('on');
          await api.sleep(400);
          store.textContent = '1';
          store.classList.add('on');
          await api.sleep(900);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const mine = h('i', null, '0');
        const opp = h('i', null, '6');
        const wrap = h('div.ka-demo');
        wrap.append(h('div.row', null, opp), h('div.row', null, mine));
        stage.append(wrap);
        return api.loop(async () => {
          mine.textContent = '0';
          opp.textContent = '6';
          mine.classList.remove('on');
          await api.finger.tap(mine, 450);
          mine.textContent = '7';
          opp.textContent = '0';
          mine.classList.add('on');
          await api.sleep(800);
        });
      },
    },
  ];
}

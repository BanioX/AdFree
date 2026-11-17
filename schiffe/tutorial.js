import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const row = h('div.sh-demo', null, h('i'), h('i'), h('i'), h('i'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          for (const c of row.children) c.className = '';
          await api.finger.tap(row.children[0], 360);
          for (let i = 0; i < 4; i++) row.children[i].className = 'ship';
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const grid = h('div.sh-demo.v', null, h('i'), h('i'), h('i'), h('i'));
        stage.append(grid);
        return api.loop(async () => {
          grid.className = 'sh-demo v';
          await api.sleep(500);
          grid.className = 'sh-demo';
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const row = h('div.sh-demo', null, h('i'), h('i'), h('i'), h('i'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          for (const c of row.children) c.className = '';
          await api.finger.tap(row.children[2], 360);
          row.children[2].className = 'hit';
          await api.sleep(700);
        });
      },
    },
  ];
}

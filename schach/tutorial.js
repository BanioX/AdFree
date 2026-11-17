import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const row = h('div.ch-demo', null, h('i.w', null, '♞'), h('i'), h('i'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          row.children[2].className = '';
          await api.finger.tap(row.children[0], 360);
          row.children[2].className = 'dot';
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const row = h('div.ch-demo', null, h('i.w', null, '♟'), h('i'), h('i.dot'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          row.children[0].textContent = '♟';
          row.children[2].textContent = '';
          await api.finger.tap(row.children[2], 360);
          row.children[0].textContent = '';
          row.children[2].textContent = '♟';
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const row = h('div.ch-demo', null, h('i.w', null, '♚'), h('i'), h('i'), h('i.w', null, '♜'));
        stage.append(row);
        return api.loop(async () => {
          await api.sleep(400);
          await api.finger.tap(row.children[0], 300);
          row.children[0].textContent = '';
          row.children[2].textContent = '♚';
          row.children[3].textContent = '';
          row.children[1].textContent = '♜';
          await api.sleep(800);
          row.children[0].textContent = '♚';
          row.children[1].textContent = '';
          row.children[2].textContent = '';
          row.children[3].textContent = '♜';
        });
      },
    },
  ];
}

import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const row = h('div.wk-demo', null, h('b', null, 'R'), h('b', null, 'A'), h('b', null, 'D'));
        stage.append(row);
        return api.loop(async () => {
          for (const b of row.children) b.className = '';
          await api.finger.tap(row.children[0], 280);
          row.children[0].className = 'on';
          await api.finger.tap(row.children[1], 280);
          row.children[1].className = 'on';
          await api.sleep(600);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const word = h('div.wk-demo', null, h('b.on', null, 'R'), h('b.on', null, 'A'), h('b.on', null, 'D'));
        stage.append(word);
        return api.loop(async () => {
          await api.finger.tap(word, 400);
          await api.sleep(600);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const list = h('div.wk-demo', null, h('i', null, 'RAD'), h('i', null, 'RAT'), h('i', null, 'ART'));
        stage.append(list);
        return api.loop(async () => {
          for (const el of list.children) el.className = '';
          await api.sleep(300);
          list.children[0].className = 'on';
          await api.sleep(280);
          list.children[1].className = 'on';
          await api.sleep(700);
        });
      },
    },
  ];
}

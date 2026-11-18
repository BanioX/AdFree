import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const row = h('div.hb-demo', null, h('b', null, 'A'), h('b.mid', null, 'E'), h('b', null, 'R'));
        stage.append(row);
        return api.loop(async () => {
          await api.finger.tap(row.children[1], 360);
          await api.sleep(600);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const word = h('div.hb-demo', null, h('b.on', null, 'E'), h('b.on', null, 'R'), h('b.on', null, 'B'), h('b.on', null, 'E'));
        stage.append(word);
        return api.loop(async () => { await api.finger.tap(word, 400); await api.sleep(600); });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const list = h('div.hb-demo', null, h('i', null, 'ERBE'), h('i', null, 'BEERE'));
        stage.append(list);
        return api.loop(async () => {
          list.children[0].className = '';
          await api.sleep(300);
          list.children[0].className = 'on';
          await api.sleep(700);
        });
      },
    },
  ];
}

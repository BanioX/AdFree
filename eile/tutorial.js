import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const die = h('div.ey-demo', null, h('b', null, '6'), h('i'), h('i.me'));
        stage.append(die);
        return api.loop(async () => {
          die.children[2].className = '';
          await api.finger.tap(die.children[0], 400);
          die.children[2].className = 'me';
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const row = h('div.ey-demo', null, h('i.me'), h('i'), h('i.ai'));
        stage.append(row);
        return api.loop(async () => {
          row.children[0].className = 'me';
          row.children[2].className = 'ai';
          await api.finger.tap(row.children[0], 380);
          row.children[0].className = '';
          row.children[2].className = 'me';
          await api.sleep(700);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const row = h('div.ey-demo', null, h('i.me'), h('i'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          row.children[0].className = 'me';
          row.children[2].className = '';
          await api.finger.tap(row.children[0], 360);
          row.children[0].className = '';
          row.children[2].className = 'me';
          await api.sleep(700);
        });
      },
    },
  ];
}

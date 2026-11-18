import { h } from '../shared/ui.js';
import { tr } from './strings.js';

export function tutorialSteps() {
  return [
    {
      title: tr('tut1'),
      text: tr('tut1t'),
      demo(stage, api) {
        const die = h('div.bg-demo', null, h('b', null, '6'));
        die.style.cssText = 'width:48px;height:48px;border-radius:10px;background:#fff;display:grid;place-items:center;font-size:22px';
        stage.append(die);
        return api.loop(async () => {
          die.firstChild.textContent = '6';
          await api.finger.tap(die, 400);
          die.firstChild.textContent = '3';
          await api.sleep(600);
        });
      },
    },
    {
      title: tr('tut2'),
      text: tr('tut2t'),
      demo(stage, api) {
        const row = h('div.bg-demo', null, h('i'), h('i'), h('i.go'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          await api.finger.tap(row.children[0], 320);
          await api.finger.tap(row.children[2], 320);
          await api.sleep(600);
        });
      },
    },
    {
      title: tr('tut3'),
      text: tr('tut3t'),
      demo(stage, api) {
        const row = h('div.bg-demo', null, h('i'), h('i.b'), h('i'));
        stage.append(row);
        return api.loop(async () => {
          row.children[1].className = 'b';
          await api.finger.tap(row.children[0], 300);
          row.children[0].className = '';
          row.children[1].className = '';
          await api.sleep(700);
        });
      },
    },
  ];
}

import { h } from '../shared/ui.js';

export function tutorialSteps() {
  return [
    {
      title: 'Eine 6 holt dich raus',
      text: 'Tippe den Würfel. Nur eine 6 setzt eine Figur aufs Startfeld.',
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
      title: 'Schlagen und sicher',
      text: 'Landest du auf einer fremden Figur, geht sie nach Hause. Startfelder sind sicher.',
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
      title: 'Genau ins Haus',
      text: 'Nach der Runde brauchst du die genaue Zahl. Beide Figuren im Haus gewinnen.',
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

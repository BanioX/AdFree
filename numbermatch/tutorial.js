// Zahlenpaare – «So geht's»: 4 kurze Schritte mit animierten Mini-Szenen.
import { h } from '../shared/ui.js';
import { NI } from '../lib/numbers/icons.js';

/** Kleines Demo-Gitter (cols Spalten) aus einem Ziffern-String; '.' = gestrichen-Ziffer folgt. */
function demoGrid(stage, cols, digits, { cs = 40 } = {}) {
  const wrap = h('div.nx-demo');
  const grid = h('div.ng.nm-grid.nm-demo', { style: { '--cols': cols, '--cs': cs + 'px', '--gap': '1px' } });
  const cells = [];
  for (const ch of digits) {
    const c = h('div.ng-cell.nm-cell', null, h('span', null, ch.replace(/[a-i]/, (m) => String(m.charCodeAt(0) - 96))));
    if (/[a-i]/.test(ch)) c.classList.add('x');
    cells.push(c);
    grid.append(c);
  }
  wrap.append(grid);
  stage.append(wrap);
  return { grid, cells };
}

const reset = (cells, digits) => cells.forEach((c, k) => {
  c.className = 'ng-cell nm-cell' + (/[a-i]/.test(digits[k]) ? ' x' : '');
  c.style.cssText = '';
});

export function tutorialSteps() {
  return [
    {
      title: 'Paare streichen',
      text: 'Tippe zwei gleiche Zahlen an – oder zwei, die zusammen 10 ergeben.',
      demo(stage, api) {
        const D = '38735' + '62146' + '21952';
        const { cells } = demoGrid(stage, 5, D);
        return api.loop(async () => {
          reset(cells, D);
          await api.sleep(400);
          await api.finger.tap(cells[1]); cells[1].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(cells[6]); cells[1].classList.remove('sel');
          cells[1].classList.add('x', 'ng-pop'); cells[6].classList.add('x', 'ng-pop');
          await api.sleep(800);
          await api.finger.tap(cells[2]); cells[2].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(cells[3]); cells[2].classList.remove('sel');
          cells[2].classList.add('x', 'ng-pop'); cells[3].classList.add('x', 'ng-pop');
          await api.sleep(1100);
        });
      },
    },
    {
      title: 'Auch über Lücken',
      text: 'Dazwischen dürfen nur gestrichene Felder liegen – auch quer und über den Zeilenumbruch.',
      demo(stage, api) {
        const D = '4bcd6' + '7ae2f' + 'g3h18';
        const { cells } = demoGrid(stage, 5, D);
        return api.loop(async () => {
          reset(cells, D);
          await api.sleep(400);
          await api.finger.tap(cells[0]); cells[0].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(cells[4]); cells[0].classList.remove('sel');
          cells[0].classList.add('x', 'ng-pop'); cells[4].classList.add('x', 'ng-pop');
          await api.sleep(800);
          await api.finger.tap(cells[5]); cells[5].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(cells[11]); cells[5].classList.remove('sel');
          cells[5].classList.add('x', 'ng-pop'); cells[11].classList.add('x', 'ng-pop');
          await api.sleep(1100);
        });
      },
    },
    {
      title: 'Reihen verschwinden',
      text: 'Ist eine Reihe ganz gestrichen, rutscht sie weg. Erfülle so das Ziel des Levels.',
      demo(stage, api) {
        const D = '58296' + 'a9cd1' + '73455';
        const { cells } = demoGrid(stage, 5, D);
        return api.loop(async () => {
          reset(cells, D);
          await api.sleep(400);
          await api.finger.tap(cells[6]); cells[6].classList.add('sel');
          await api.sleep(250);
          await api.finger.tap(cells[9]); cells[6].classList.remove('sel');
          cells[6].classList.add('x', 'ng-pop'); cells[9].classList.add('x', 'ng-pop');
          await api.sleep(450);
          for (let k = 5; k < 10; k++) cells[k].classList.add('nm-gone');
          await api.sleep(500);
          for (let k = 5; k < 10; k++) cells[k].style.display = 'none';
          await api.sleep(1300);
        });
      },
    },
    {
      title: 'Zahlen hinzufügen',
      text: 'Keine Paare mehr? «Hinzufügen» hängt alle offenen Zahlen unten an. Tipps sind gratis.',
      demo(stage, api) {
        const D = '1a6b' + 'c42d';
        const wrap = h('div.nx-demo.nm-demo-add');
        const grid = h('div.ng.nm-grid.nm-demo', { style: { '--cols': 4, '--cs': '38px', '--gap': '1px' } });
        const btn = h('div.nm-demo-btn', { html: NI.plusRows });
        wrap.append(grid, btn);
        stage.append(wrap);
        const cell = (ch, isNew) => {
          const x = /[a-i]/.test(ch);
          const c = h('div.ng-cell.nm-cell' + (x ? '.x' : '') + (isNew ? '.nm-new' : ''), null, h('span', null, x ? String(ch.charCodeAt(0) - 96) : ch));
          grid.append(c);
          return c;
        };
        return api.loop(async () => {
          grid.replaceChildren();
          for (const ch of D) cell(ch);
          await api.sleep(500);
          await api.finger.tap(btn);
          btn.classList.add('ng-pop');
          for (const ch of '1642') { cell(ch, true); await api.sleep(110); }
          await api.sleep(300);
          btn.classList.remove('ng-pop');
          api.finger.hide();
          await api.sleep(1400);
        });
      },
    },
  ];
}

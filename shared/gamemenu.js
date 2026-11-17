// Einheitlicher Startbildschirm für alle Spiele.
//
//   import { gameMenu } from '../shared/gamemenu.js';
//   app.replaceChildren(gameMenu({
//     id: 'sudoku',                       // Spiel-ID (Icon /icons/games/<id>.svg wird als Bild genutzt)
//     title: 'Sudoku',
//     tagline: 'Zahlen 1–9 logisch einsetzen',
//     accent: '#4a7bd0',
//     art: nodeOrSvgString,               // optional: eigenes Titelbild/Live-Vorschau statt Icon
//     primary: { label: 'Weiterspielen', sub: 'Mittel · 04:12', onClick },
//     daily: { done: false, sub: 'Mittel', streak: 3, onClick },   // optional
//     modes: { label: 'Schwierigkeit', value: 'mittel',            // optional
//              options: [{ id: 'leicht', label: 'Leicht' }, …], onChange(id) {} },
//     secondary: [{ label: 'Neues Spiel', icon: 'plus', onClick }, …],   // optional, 1–3 Knöpfe
//     stats: [{ label: 'Gelöst', value: '12' }, …],                     // optional, max. 4
//     sections: [node, …],                // optional: Levelkarte, Galerie, Packs …
//     onHelp: () => showTutorial(…),      // «?»-Knopf und Link «So geht's»
//     backHref: '../',
//   }));
//
// Gibt ein Element zurück, das in .app eingesetzt wird (Topbar + scrollbarer Inhalt).
// Das Spiel kann einzelne Teile später aktualisieren: menu.update({ primary, daily, stats }).

import { h, icon, soundButton, backButton } from './ui.js';
import { sfx } from './sfx.js';
import { todayKey } from './storage.js';
import { L, lang } from './i18n.js';

const MONTHS = lang === 'en'
  ? ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  : ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sept.', 'Okt.', 'Nov.', 'Dez.'];

export function gameMenu(opts) {
  const root = h('div.gm');
  if (opts.accent) root.style.setProperty('--accent', opts.accent);

  // Topbar
  const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': L('So geht’s', 'How to play') });
  helpBtn.innerHTML = '<span class="gm-q">?</span>';
  helpBtn.addEventListener('click', () => { sfx.play('click'); opts.onHelp && opts.onHelp(); });
  const topbar = h('div.topbar.gm-topbar', null,
    backButton(opts.backHref || '../'),
    h('div.spacer'),
    opts.onHelp ? helpBtn : null,
    soundButton());

  // Held: Bild, Titel, Untertitel
  const art = h('div.gm-art');
  if (opts.art) {
    if (typeof opts.art === 'string') art.innerHTML = opts.art; else art.append(opts.art);
    art.classList.add('custom');
  } else {
    art.append(h('img', { src: `../icons/games/${opts.id}.svg`, alt: '', draggable: 'false' }));
  }
  const hero = h('div.gm-hero', null,
    art,
    h('h1.gm-title', null, opts.title),
    opts.tagline ? h('p.gm-tagline', null, opts.tagline) : null);

  const primaryWrap = h('div.gm-primary-wrap');
  const dailyWrap = h('div');
  const modesWrap = h('div');
  const secondaryWrap = h('div');
  const statsWrap = h('div');
  const sectionsWrap = h('div.gm-sections');

  const content = h('div.gm-content', null,
    hero, primaryWrap, dailyWrap, modesWrap, secondaryWrap, statsWrap, sectionsWrap,
    opts.onHelp ? h('button.gm-howto', { type: 'button', onclick: () => { sfx.play('click'); opts.onHelp(); } },
      h('span', { html: icon('hint', { size: 18 }) }), L('So geht’s', 'How to play')) : null);

  const scroll = h('div.scroll.gm-scroll', null, content);
  root.append(topbar, scroll);

  function renderPrimary(p) {
    primaryWrap.replaceChildren();
    if (!p) return;
    const b = h('button.gm-primary', { type: 'button' },
      h('span.gm-primary-icon', { html: icon(p.icon || 'play', { size: 22 }) }),
      h('span.gm-primary-text', null,
        h('span.gm-primary-label', null, p.label),
        p.sub ? h('span.gm-primary-sub', null, p.sub) : null));
    b.addEventListener('click', () => { sfx.play('tap'); p.onClick && p.onClick(); });
    primaryWrap.append(b);
  }

  function renderDaily(d) {
    dailyWrap.replaceChildren();
    if (!d) return;
    const now = new Date();
    const badge = h('div.gm-cal', null, h('span.gm-cal-m', null, MONTHS[now.getMonth()]), h('span.gm-cal-d', null, String(now.getDate())));
    const status = d.done
      ? L(`✓ Gelöst${d.streak > 1 ? ` · ${d.streak} Tage in Folge` : ''}`, `✓ Solved${d.streak > 1 ? ` · ${d.streak}-day streak` : ''}`)
      : (d.streak > 0
        ? L(`Serie: ${d.streak} ${d.streak === 1 ? 'Tag' : 'Tage'} – heute weitermachen`, `Streak: ${d.streak} ${d.streak === 1 ? 'day' : 'days'} – keep it going today`)
        : L('Heute noch offen', 'Not solved yet today'));
    const card = h('button.gm-daily' + (d.done ? '.done' : ''), { type: 'button', 'data-day': todayKey() },
      badge,
      h('span.gm-daily-text', null,
        h('b', null, d.label || L('Tagesrätsel', 'Daily puzzle')),
        h('small', null, d.sub ? `${d.sub} · ${status}` : status)),
      h('span.gm-chev', { html: icon('back', { size: 18 }) }));
    card.addEventListener('click', () => { sfx.play('tap'); d.onClick && d.onClick(); });
    dailyWrap.append(card);
  }

  function renderModes(m) {
    modesWrap.replaceChildren();
    if (!m || !m.options || !m.options.length) return;
    let value = m.value;
    const seg = h('div.gm-seg', { role: 'tablist' });
    const paint = () => [...seg.children].forEach((c) => c.classList.toggle('on', c.dataset.id === value));
    for (const o of m.options) {
      const b = h('button', { type: 'button', role: 'tab', 'data-id': o.id },
        h('span', null, o.label), o.sub ? h('small', null, o.sub) : null);
      b.addEventListener('click', () => {
        if (value === o.id) return;
        value = o.id; paint(); sfx.play('click');
        m.onChange && m.onChange(o.id);
      });
      seg.append(b);
    }
    paint();
    modesWrap.append(h('div.gm-block', null, m.label ? h('div.gm-label', null, m.label) : null, seg));
  }

  function renderSecondary(list) {
    secondaryWrap.replaceChildren();
    if (!list || !list.length) return;
    const row = h('div.gm-secondary');
    for (const s of list) {
      const b = h('button.gm-sec', { type: 'button' },
        s.icon ? h('span.gm-sec-icon', { html: icon(s.icon, { size: 20 }) }) : null,
        h('span.gm-sec-text', null, h('b', null, s.label), s.sub ? h('small', null, s.sub) : null));
      b.addEventListener('click', () => { sfx.play('click'); s.onClick && s.onClick(); });
      row.append(b);
    }
    secondaryWrap.append(row);
  }

  function renderStats(list) {
    statsWrap.replaceChildren();
    if (!list || !list.length) return;
    statsWrap.append(h('div.gm-stats', null, list.slice(0, 4).map((s) =>
      h('div.gm-stat', null, h('b', null, String(s.value)), h('small', null, s.label)))));
  }

  renderPrimary(opts.primary);
  renderDaily(opts.daily);
  renderModes(opts.modes);
  renderSecondary(opts.secondary);
  renderStats(opts.stats);
  if (opts.sections) sectionsWrap.append(...opts.sections.filter(Boolean));

  root.update = (u = {}) => {
    if ('primary' in u) renderPrimary(u.primary);
    if ('daily' in u) renderDaily(u.daily);
    if ('modes' in u) renderModes(u.modes);
    if ('secondary' in u) renderSecondary(u.secondary);
    if ('stats' in u) renderStats(u.stats);
    if ('sections' in u) sectionsWrap.replaceChildren(...(u.sections || []).filter(Boolean));
  };
  root.scroller = scroll;
  return root;
}

/** Überschrift für einen Abschnitt im Startbildschirm (z.B. «Levels», «Bilder»). */
export function menuSection(title, ...children) {
  return h('section.gm-section', null, h('h2.gm-section-title', null, title), ...children);
}

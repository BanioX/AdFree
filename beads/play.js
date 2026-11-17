// Perlenbild – Spielbildschirm (Steuerung: Eingabe, Helfer, Speichern, Gewinn).

import { h, icon, toast, showModal, celebrate, soundButton, backButton, sleep } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { BoardView } from './render.js';
import { drawPicture } from './gems.js';
import { MAX_SLOTS } from './level.js';
import { resetCombo } from './sound.js';

export class PlayScreen {
  /**
   * opts: {
   *   game, title, subtitle, backHref, saveKey,
   *   save(data), onComplete(game, stars), onNext(), onAlbum(), nextLabel
   * }
   */
  constructor(root, opts) {
    this.opts = opts;
    this.game = opts.game;
    this.completed = false;
    this.destroyed = false;
    this.saveTimer = 0;

    const titleEl = h('div.title.center', null, opts.title, opts.subtitle ? h('small', null, ' · ' + opts.subtitle) : null);
    this.bar = h('i');
    this.canvas = h('canvas', { 'aria-label': 'Spielfeld' });
    this.stage = h('div.bp-stage', null, this.canvas);
    this.tip = h('div.bp-tip', { role: 'status' }, 'Kleiner Tipp: Nutze einen Helfer');
    const mk = (name, label, aria) => {
      const b = h('button.bp-helper', { type: 'button', 'aria-label': aria });
      const ic = name === '+1' ? '<b>+1</b>' : icon(name, { size: 19 });
      b.innerHTML = `<span class="ic">${ic}</span><span>${label}</span>`;
      return b;
    };
    this.btnMagnet = mk('bolt', 'Magnet', 'Magnet: holt die nächsten passenden Steine');
    this.btnMix = mk('shuffle', 'Mischen', 'Mischen: passende Farben nach vorne');
    this.btnSlot = mk('+1', 'Ablage', '+1 Ablage: ein zusätzlicher Ablageplatz');
    this.btnMagnet.addEventListener('click', () => this.useMagnet());
    this.btnMix.addEventListener('click', () => this.useMix());
    this.btnSlot.addEventListener('click', () => this.useSlot());

    this.el = h('div.bp-play', { style: { display: 'contents' } },
      h('header.topbar', null, backButton(opts.backHref || '#menu'), titleEl, soundButton()),
      h('div.bp-progress', { role: 'progressbar', 'aria-label': 'Fortschritt' }, this.bar),
      this.stage,
      h('div.bp-helpers', null, this.tip, this.btnMagnet, this.btnMix, this.btnSlot),
    );
    root.append(this.el);

    this.view = new BoardView(this.canvas, {
      onColumnTap: (c) => this.tap(c),
      onProgress: (p, t) => this.setBar(p / t),
    });
    this.view.setGame(this.game);
    this.setBar(this.game.progress);
    this.updateSlotButton();
    resetCombo();

    this._hide = () => { if (document.visibilityState === 'hidden') this.flush(); };
    this._pagehide = () => this.flush();
    document.addEventListener('visibilitychange', this._hide);
    window.addEventListener('pagehide', this._pagehide);

    this.installDebug();

    if (this.game.complete) {
      // Sollte nicht vorkommen (fertige Level werden nicht gespeichert) – sicherheitshalber
      this.onLogicalComplete();
    } else {
      this.checkStuck();
    }
  }

  destroy() {
    if (this.destroyed) return;
    this.flush();
    this.destroyed = true;
    this.view.destroy();
    document.removeEventListener('visibilitychange', this._hide);
    window.removeEventListener('pagehide', this._pagehide);
    if (window.__beads && window.__beads.screen === this) delete window.__beads;
  }

  setBar(f) {
    this.bar.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(1) + '%';
  }

  // ---------------------------------------------------------------- Aktionen

  tap(c) {
    if (this.completed || this.destroyed) return;
    const res = this.game.tap(c);
    if (res.status === 'refused') {
      sfx.play('error');
      this.view.refuse(c);
      toast('Ablage voll');
      this.checkStuck();
      return;
    }
    if (res.status !== 'ok') return;
    sfx.play('tap');
    this.view.applyMoves(res.moves);
    this.afterAction();
  }

  useMagnet() {
    if (this.completed) return;
    const moves = this.game.magnet();
    if (!moves.length) return;
    sfx.play('whoosh');
    this.view.applyMoves(moves, { stagger: 55 });
    this.afterAction();
  }

  useMix() {
    if (this.completed) return;
    const cols = this.game.shuffle();
    if (!cols) return;
    sfx.play('whoosh');
    this.view.shuffleTray(this.game.trayColumns());
    this.afterAction();
  }

  useSlot() {
    if (this.completed) return;
    if (!this.game.addSlot()) {
      toast('Mehr Ablageplätze passen nicht hin');
      return;
    }
    sfx.play('pop');
    this.view.setSlots(this.game.st.S);
    this.updateSlotButton();
    this.afterAction();
  }

  updateSlotButton() {
    this.btnSlot.disabled = this.game.st.S >= MAX_SLOTS;
  }

  afterAction() {
    this.hideTip();
    this.saveSoon();
    if (this.game.complete) { this.onLogicalComplete(); return; }
    this.checkStuck();
  }

  checkStuck() {
    if (!this.game.isStuck()) { this.hideTip(); return; }
    this.view.whenIdle(() => {
      if (!this.destroyed && !this.completed && this.game.isStuck()) this.showTip();
    });
  }

  showTip() {
    this.tip.classList.add('show');
    for (const b of [this.btnMagnet, this.btnMix, this.btnSlot]) if (!b.disabled) b.classList.add('pulse');
  }

  hideTip() {
    this.tip.classList.remove('show');
    for (const b of [this.btnMagnet, this.btnMix, this.btnSlot]) b.classList.remove('pulse');
  }

  // ---------------------------------------------------------------- Speichern

  saveSoon() {
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => this.flush(), 250);
  }

  flush() {
    clearTimeout(this.saveTimer);
    if (this.destroyed || this.completed) return;
    if (this.opts.save) this.opts.save(this.game.serialize());
  }

  // ---------------------------------------------------------------- Gewinn

  onLogicalComplete() {
    if (this.completed) return;
    this.completed = true;
    clearTimeout(this.saveTimer);
    for (const b of [this.btnMagnet, this.btnMix, this.btnSlot]) b.disabled = true;
    const stars = this.game.stars();
    if (this.opts.onComplete) this.opts.onComplete(this.game, stars);
    this.view.whenIdle(() => {
      if (this.destroyed) return;
      sfx.play('sparkle');
      this.view.startShine(() => this.showWin(stars));
    });
  }

  async showWin(stars) {
    if (this.destroyed) return;
    sfx.play('complete');
    const bright = this.game.L.colors.filter((c) => {
      const v = parseInt(c.slice(1), 16);
      return (0.299 * (v >> 16) + 0.587 * ((v >> 8) & 255) + 0.114 * (v & 255)) > 70;
    });
    celebrate([...bright.slice(0, 6), '#3f8ef0', '#ffd23f']);
    await sleep(450);
    if (this.destroyed) return;
    const L = this.game.L;
    const starsEl = h('div.bp-stars', { 'aria-label': `${stars} von 3 Sternen` });
    for (let i = 0; i < 3; i++) {
      const s = h('span' + (i < stars ? '.on' : ''));
      s.innerHTML = icon('star', { size: 46 });
      starsEl.append(s);
    }
    const cv = h('canvas');
    const size = Math.min(210, window.innerWidth - 120);
    drawPicture(cv, L, { size, pad: 0.07 });
    const used = this.game.helpersUsed();
    const text = used === 0 ? 'Ganz ohne Helfer – wunderbar!'
      : used === 1 ? 'Mit einem Helfer gelegt.' : `Mit ${used} Helfern gelegt.`;
    const content = h('div.bp-win', null, starsEl, cv, h('p', null, `«${L.title}» ist fertig. ${text}`));
    const v = await showModal({
      title: 'Geschafft!',
      content,
      dismissible: false,
      buttons: [
        { label: this.opts.nextLabel || 'Weiter', value: 'next', primary: true, icon: 'play' },
        { label: 'Sammlung', value: 'album', icon: 'grid' },
      ],
    });
    if (this.destroyed) return;
    if (v === 'album') this.opts.onAlbum && this.opts.onAlbum();
    else this.opts.onNext && this.opts.onNext();
  }

  // ---------------------------------------------------------------- Test-Hilfe

  installDebug() {
    const self = this;
    window.__beads = {
      screen: this,
      get game() { return self.game; },
      get view() { return self.view; },
      solverMove: (n) => self.game.solverMove(n),
      legal: () => self.game.legalColumns(),
      stuck: () => self.game.isStuck(),
      idle: () => !self.view.raf && !self.view.flyers.length,
      columnPoint(c) {
        const r = self.canvas.getBoundingClientRect();
        const p = self.view.columnCenter(c);
        return { x: r.left + p.x, y: r.top + p.y };
      },
      /** Prüft, ob die Anzeige (nach Ende der Animationen) exakt der Spiellogik entspricht. */
      consistent() {
        const g = self.game;
        const v = self.view;
        const st = g.st;
        if (v.visPlaced !== st.placed) return `placed ${v.visPlaced} != ${st.placed}`;
        for (let s = 0; s < st.S; s++) {
          const vs = v.slots[s];
          const n = vs ? vs.n : 0;
          if (n !== st.slotN[s] || (n > 0 && vs.k !== st.slotK[s])) return `slot ${s}`;
        }
        const cols = g.trayColumns();
        for (let c = 0; c < cols.length; c++) {
          if (cols[c].length !== v.cols[c].length || cols[c].some((k, i) => v.cols[c][i].k !== k)) return `col ${c}`;
        }
        const m = g.filledMask();
        for (let i = 0; i < m.length; i++) if (!!m[i] !== !!v.visFilled[i]) return `cell ${i}`;
        return 'ok';
      },
      state: () => ({
        placed: self.game.st.placed,
        total: self.game.L.total,
        complete: self.game.complete,
        S: self.game.st.S,
        slots: Array.from(self.game.st.slotK.slice(0, self.game.st.S)),
        cols: self.game.st.cols.length,
        visPlaced: self.view.visPlaced,
      }),
    };
  }
}

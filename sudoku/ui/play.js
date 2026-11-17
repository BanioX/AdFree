// Spielansicht: Brett, Werkzeuge, Zahlenfeld, Timer, Tipps, Pause.
import { h, toast, showModal, sleep } from '../../shared/ui.js';
import { sfx } from '../../shared/sfx.js';
import { icon } from './icons.js';
import { Board } from './board.js';
import { UNITS, CELL_UNITS, PEERS, bit, candidatesFromValues } from '../logic/board.js';
import { findHint } from '../logic/hints.js';
import { makeState, findStep } from '../logic/human.js';
import { describeStep, hintTexts } from '../data/texts.js';
import { formatTime } from '../progress.js';

/** Sofort beim Antippen auslösen (schneller als click, und mehrfaches schnelles Tippen geht nicht verloren). */
function onPress(el, fn) {
  el.addEventListener('pointerdown', (e) => {
    if (e.button > 0) return;
    e.preventDefault();
    fn(e);
  });
  // Tastatur / Screenreader (click ohne Zeiger)
  el.addEventListener('click', (e) => { if (e.detail === 0) fn(e); });
}

export class Play {
  /**
   * @param {object} o
   * @param {import('../logic/game.js').Game} o.game
   * @param {object} o.settings     aktuelle Einstellungen (live-Objekt)
   * @param {string} o.title        z.B. «Mittel» oder «Tagesrätsel»
   * @param {string} o.label        z.B. «Rätsel Nr. 12»
   * @param {Function} o.onBack
   * @param {Function} o.onSave     (game) => void
   * @param {Function} o.onWin      (game) => Promise<void>   (Statistik, Sieg-Blatt)
   * @param {Function} o.onSettings () => Promise<void>
   * @param {Function} o.onNext     () => void   (nächstes Rätsel)
   * @param {Function} o.onMenu     () => void
   * @param {Function} o.onProgress (game) => void
   * @param {Function} o.onGiveUp   () => void   (Spiel nach 3 Fehlern beenden)
   * @param {Function} o.onSolved   (game) => info  (sofort beim Lösen: Statistik, Tagesrätsel-Häkchen)
   * @param {Function} o.onHelp     () => Promise<void>  («?»: So geht's)
   * @param {Function} [o.nextLabel] () => string  Beschriftung des Hauptknopfs im Fertig-Feld
   * @param {boolean}  [o.coach]    Coach-Mark am Brett zeigen (allererstes Rätsel)
   * @param {Function} [o.onCoachDone] () => void
   */
  constructor(o) {
    this.o = o;
    this.game = o.game;
    this.settings = o.settings;
    // Auswahl und Notizen-Modus kommen nach dem Neuladen wieder
    const m = this.game.meta;
    const live = !this.game.done;
    this.sel = live && Number.isInteger(m.sel) && m.sel >= 0 && m.sel < 81 ? m.sel : this._firstEmpty();
    this.focusDigit = this.sel != null ? this.game.values[this.sel] || 0 : 0;
    this.notesMode = live && !!m.notesMode;
    this.hint = null;
    this.locked = false;
    this.modalOpen = false;
    this.destroyed = false;
    this._build();
    this._lastTick = performance.now();
    this._timer = setInterval(() => this._tick(), 250);
    this._saveTimer = setInterval(() => this.save(), 5000);
    this._onVis = () => {
      this._tick();
      if (document.hidden) this.save();
    };
    this._onKey = (e) => this._key(e);
    this._onHide = () => this.save();
    document.addEventListener('visibilitychange', this._onVis);
    window.addEventListener('keydown', this._onKey);
    window.addEventListener('pagehide', this._onHide);
    this.render();
    this._updateTimer();
    if (this.game.done) this._showDone(false);
    else if (this._strikeOut()) setTimeout(() => this._gameOver(), 300);
    else if (o.coach && this.game.moves === 0) this._startCoach();
  }

  destroy() {
    this._tick();
    this.save();
    this.destroyed = true;
    clearInterval(this._timer);
    clearInterval(this._saveTimer);
    clearTimeout(this._resizeT);
    if (this._ro) this._ro.disconnect();
    document.removeEventListener('visibilitychange', this._onVis);
    window.removeEventListener('keydown', this._onKey);
    window.removeEventListener('pagehide', this._onHide);
  }

  // ---------- Aufbau ----------

  _build() {
    const g = this.game;
    this.board = new Board({ onCell: (i, kind) => this._cellTap(i, kind) });

    const back = h('button.icon-btn', { type: 'button', 'aria-label': 'Zurück zum Menü' });
    back.innerHTML = icon('back');
    back.addEventListener('click', () => { sfx.play('click'); this.o.onBack(); });

    this.titleEl = h('div.title', null, this.o.title);
    this.subEl = h('div.sub');
    this.timerText = h('span.t');
    this.timerIcon = h('span.ti');
    this.timerBtn = h('button.timer-pill', { type: 'button', 'aria-label': 'Pause' }, this.timerIcon, this.timerText);
    onPress(this.timerBtn, () => { if (this.locked || g.done) return; sfx.play('click'); this.setPaused(!g.paused); });

    const settingsBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'Einstellungen' });
    settingsBtn.innerHTML = icon('settings');
    settingsBtn.addEventListener('click', async () => {
      sfx.play('click');
      this.modalOpen = true;
      await this.o.onSettings();
      this.modalOpen = false;
      this._lastTick = performance.now();
      this.render();
      this._updateTimer();
    });

    const helpBtn = h('button.icon-btn', { type: 'button', 'aria-label': 'So geht’s' });
    helpBtn.innerHTML = '<span class="gm-q">?</span>';
    helpBtn.addEventListener('click', () => { sfx.play('click'); this.openModal(() => this.o.onHelp()); });

    const top = h('header.topbar.play-top', null,
      back,
      h('div.title-wrap', null, this.titleEl, this.subEl),
      this.timerBtn,
      helpBtn,
      settingsBtn);

    // Pause-Schleier
    const resume = h('button.btn.primary.resume', { type: 'button' });
    resume.innerHTML = icon('play', { size: 22 });
    resume.append('Weiter');
    resume.addEventListener('click', () => { sfx.play('click'); this.setPaused(false); });
    this.veil = h('div.pause-veil', null, h('div.pause-card', null, h('div.pause-title', null, 'Pause'), h('div.pause-sub', null, this.o.label || ''), resume));

    this.boardWrap = h('div.board-wrap', null, this.board.el, this.veil);
    // Fortschritts-Leiste über dem Brett (nur wenn genug Platz ist)
    this.stripLabel = h('span.strip-l', null, this.o.label || '');
    this.stripPct = h('span.strip-r');
    this.stripBar = h('i');
    this.strip = h('div.strip', null, h('div.strip-row', null, this.stripLabel, this.stripPct), h('div.strip-bar', null, this.stripBar));
    this.stack = h('div.board-stack', null, this.strip, this.boardWrap);
    this.area = h('div.board-area', null, this.stack);

    // Werkzeuge
    const tool = (name, label, ic, fn) => {
      const b = h('button.tool', { type: 'button', 'data-tool': name, 'aria-label': label });
      b.innerHTML = `<span class="ic">${icon(ic, { size: 24 })}</span><span class="lb">${label}</span>`;
      onPress(b, () => { if (!this.locked) fn(); });
      return b;
    };
    this.undoBtn = tool('undo', 'Zurück', 'undo', () => this.undo());
    this.eraseBtn = tool('erase', 'Löschen', 'eraser', () => this.erase());
    this.notesBtn = tool('notes', 'Notizen', 'pencil', () => this.toggleNotes());
    this.notesBadge = h('span.badge-mini', null, 'AUS');
    this.notesBtn.querySelector('.ic').append(this.notesBadge);
    this.autoBtn = tool('auto', 'Alle Notizen', 'wand', () => this.autoNotes());
    this.hintBtn = tool('hint', 'Tipp', 'hint', () => this.showHint());
    this.tools = h('div.tools', null, this.undoBtn, this.eraseBtn, this.notesBtn, this.autoBtn, this.hintBtn);

    // Zahlenfeld
    this.padBtns = [];
    this.pad = h('div.pad');
    for (let d = 1; d <= 9; d++) {
      const cnt = h('small', null, '');
      const b = h('button.key', { type: 'button', 'data-d': d, 'aria-label': `Zahl ${d}` }, h('b', null, String(d)), cnt);
      onPress(b, () => { if (!this.locked) this.input(d); });
      this.padBtns.push({ b, cnt });
      this.pad.append(b);
    }

    // Tipp-Karte
    this.hintTitle = h('div.hint-title');
    this.hintText = h('p.hint-text');
    this.hintAction = h('button.btn.primary.hint-act', { type: 'button' });
    this.hintClose = h('button.btn.hint-ok', { type: 'button' }, 'OK');
    this.hintClose.addEventListener('click', () => { sfx.play('click'); this.closeHint(); });
    this.hintAction.addEventListener('click', () => this._hintAct());
    const hintIc = h('span.hint-ic');
    hintIc.innerHTML = icon('hint', { size: 22 });
    this.hintCard = h('div.hint-card', { role: 'status' },
      h('div.hint-head', null, hintIc, this.hintTitle),
      this.hintText,
      h('div.hint-btns', null, this.hintClose, this.hintAction));

    // Fertig-Feld (nach dem Lösen)
    this.donePanel = h('div.done-panel');

    this.controls = h('div.controls', null, this.tools, this.pad, this.hintCard, this.donePanel);
    this.el = h('div.screen.play', null, top, this.area, this.controls);

    this._ro = new ResizeObserver(() => this._layout());
    this._ro.observe(this.area);
  }

  _layout() {
    const r = this.area.getBoundingClientRect();
    const STRIP = 40;
    const showStrip = r.height - Math.min(r.width, 560) >= STRIP + 28;
    this.strip.classList.toggle('hidden', !showStrip);
    const size = Math.max(200, Math.floor(Math.min(r.width, r.height - (showStrip ? STRIP : 0), 560)));
    this.stack.style.width = size + 'px';
    this.boardWrap.style.width = size + 'px';
    this.boardWrap.style.height = size + 'px';
    this.el.style.setProperty('--cs', (size / 9).toFixed(2) + 'px');
  }

  _firstEmpty() {
    // Startauswahl: kein Feld (ruhiger Anfang)
    return null;
  }

  // ---------- Zeit ----------

  _running() {
    return !this.destroyed && !this.game.done && !this.game.paused && !document.hidden && !this.modalOpen && !this.locked;
  }

  _tick() {
    const now = performance.now();
    const dt = now - this._lastTick;
    this._lastTick = now;
    if (this._running() && dt > 0 && dt < 5000) {
      this.game.elapsed += dt;
      this._updateTimer();
    }
  }

  _updateTimer() {
    const g = this.game;
    this.timerText.textContent = formatTime(g.elapsed);
    this.timerBtn.classList.toggle('hide-time', !this.settings.showTimer);
    this.timerIcon.innerHTML = icon(g.paused ? 'play' : 'pause', { size: 16 });
    this.timerBtn.setAttribute('aria-label', g.paused ? 'Weiter' : 'Pause');
    this.timerBtn.classList.toggle('paused', !!g.paused);
    this.timerBtn.disabled = g.done;
  }

  setPaused(p) {
    if (this.game.done) return;
    this._tick();
    this.game.paused = !!p;
    this.el.classList.toggle('is-paused', this.game.paused);
    if (p) this.closeHint();
    this._updateTimer();
    this.save();
  }

  save() {
    if (this.destroyed) return;
    const m = this.game.meta;
    if (this.game.done) { delete m.sel; delete m.notesMode; } else { m.sel = this.sel; m.notesMode = this.notesMode; }
    this.o.onSave(this.game);
  }

  /** Öffnet ein Fenster über dem Spiel; die Uhr steht so lange still. */
  async openModal(fn) {
    if (this.modalOpen) return;
    this._tick();
    this.modalOpen = true;
    try { await fn(); } finally {
      this.modalOpen = false;
      this._lastTick = performance.now();
      if (!this.destroyed) { this.render(); this._updateTimer(); }
    }
  }

  // ---------- Coach-Mark (allererstes Rätsel) ----------

  _startCoach() {
    const st = findStep(makeState(this.game.values), 1);
    if (!st || !st.place) return;
    this.coach = { cell: st.place.c, digit: st.place.d, stage: 1 };
    this.sel = null;
    this.focusDigit = 0;
    this.notesMode = false;
    this.coachRing = h('span.coach-ring');
    this.board.cellEl(st.place.c).append(this.coachRing);
    // Kurzer Hinweis in der Leiste über dem Brett (oder als Meldung, wenn sie keinen Platz hat)
    setTimeout(() => { if (this.coach && this.coach.stage === 1 && !this.destroyed) this._coachMsg('Tippe auf das leuchtende Feld'); }, 400);
  }

  _coachMsg(text) {
    this.stripLabel.textContent = text || this.o.label || '';
    this.strip.classList.toggle('coaching', !!text);
    if (text && this.strip.classList.contains('hidden') && !this.modalOpen) toast(text);
  }

  _coachStep(kind) {
    const c = this.coach;
    if (!c) return;
    if (kind === 'cell' && c.stage === 1) {
      if (this.coachRing) { this.coachRing.remove(); this.coachRing = null; }
      c.stage = 2;
      if (this.sel === c.cell) {
        this.padBtns[c.digit - 1].b.classList.add('coach');
        this._coachMsg('Jetzt unten die passende Zahl antippen');
      } else this._endCoach();
    } else if (kind === 'input') {
      this._endCoach();
    }
  }

  _endCoach() {
    if (!this.coach) return;
    if (this.coachRing) this.coachRing.remove();
    this.coachRing = null;
    this._coachMsg('');
    for (const { b } of this.padBtns) b.classList.remove('coach');
    this.coach = null;
    if (this.o.onCoachDone) this.o.onCoachDone();
  }

  // ---------- Eingabe ----------

  _cellTap(i, kind) {
    if (this.game.paused || this.locked) return;
    if (this.hint) this.closeHint();
    if (this.sel === i && kind === 'down') return;
    this.sel = i;
    this.focusDigit = this.game.values[i] || 0;
    if (kind === 'down') sfx.play('click');
    this.render();
    if (this.coach) this._coachStep('cell');
  }

  input(d) {
    const g = this.game;
    if (g.done || g.paused) return;
    if (this.hint) this.closeHint();
    const i = this.sel;
    if (i == null || g.isGiven(i)) {
      // Kein bearbeitbares Feld: Ziffer überall hervorheben
      this.focusDigit = this.focusDigit === d && i == null ? 0 : d;
      if (i != null && g.isGiven(i)) this.sel = null;
      sfx.play('click');
      this.render();
      return;
    }
    if (this.notesMode) {
      const r = g.toggleNote(i, d);
      if (r && r.changed) {
        sfx.play('tap');
        this.focusDigit = 0;
        this.render();
        this.save();
      }
      return;
    }
    this.place(i, d);
  }

  place(i, d) {
    const g = this.game;
    const s = this.settings;
    const r = g.setValue(i, d, { cleanup: s.autoClean, mistakeMode: s.showMistakes ? 'solution' : 'conflict' });
    if (!r || !r.changed) return;
    if (this.coach) this._coachStep('input');
    // Sieg sofort verbuchen (Statistik, Häkchen) – das Sieg-Blatt folgt nach der Feier-Welle
    if (r.solved) this._winInfo = this.o.onSolved ? this.o.onSolved(g) : null;
    this.focusDigit = d;
    this.render();
    this.board.pop(i);
    if (r.mistake) {
      sfx.play('error');
      this.board.shake(i);
      if (r.conflictWith.length) this.board.flashBad(r.conflictWith);
      this.subEl.classList.remove('bump');
      void this.subEl.offsetWidth;
      this.subEl.classList.add('bump');
    } else if (r.conflictWith.length) {
      this.board.flashBad(r.conflictWith);
      sfx.play('place');
    } else {
      sfx.play(r.units.length ? 'fill' : 'place');
    }
    if (r.units.length) {
      for (const u of r.units) this.board.wave(UNITS[u], i);
      if (r.units.length > 1) setTimeout(() => sfx.play('sparkle'), 160);
    }
    if (r.digitDone) {
      const cells = [];
      for (let k = 0; k < 81; k++) if (g.values[k] === d) cells.push(k);
      setTimeout(() => { this.board.bounce(cells); sfx.play('sparkle'); }, r.units.length ? 260 : 60);
    }
    this.save();
    this.o.onProgress(g);
    if (r.solved) this._win();
    else if (r.mistake && this._strikeOut()) setTimeout(() => this._gameOver(), 450);
  }

  erase() {
    const g = this.game;
    if (g.done || g.paused) return;
    const i = this.sel;
    if (i == null) { toast('Wähle zuerst ein Feld'); return; }
    if (g.isGiven(i)) { this.board.shake(i); toast('Vorgaben bleiben stehen'); return; }
    const r = g.erase(i);
    if (r && r.changed) {
      sfx.play('tap');
      this.focusDigit = 0;
      this.render();
      this.save();
      this.o.onProgress(g);
    }
  }

  undo() {
    const g = this.game;
    if (g.done || g.paused) return;
    const r = g.undo();
    if (!r || !r.changed) { toast('Nichts mehr rückgängig zu machen'); return; }
    sfx.play('whoosh');
    if (r.cells.length === 1 || r.kind === 'set' || r.kind === 'erase' || r.kind === 'note') {
      this.sel = r.cells[0];
      this.focusDigit = g.values[this.sel] || 0;
    }
    this.render();
    for (const c of r.cells.slice(0, 1)) this.board.noteIn(c);
    this.save();
    this.o.onProgress(g);
  }

  toggleNotes() {
    if (this.game.done) return;
    this.notesMode = !this.notesMode;
    sfx.play('click');
    this.render();
    this.save();
  }

  autoNotes() {
    const g = this.game;
    if (g.done || g.paused) return;
    const r = g.autoNotes();
    if (r && r.changed) {
      sfx.play('sparkle');
      this.render();
      r.cells.forEach((c) => this.board.noteIn(c));
      toast('Alle Notizen ergänzt');
      this.save();
    } else {
      toast('Notizen sind schon vollständig');
    }
  }

  _key(e) {
    if (this.destroyed || this.modalOpen || document.querySelector('.sp-modal-backdrop')) return;
    if (e.metaKey || e.altKey) return;
    const k = e.key;
    if ((e.ctrlKey && (k === 'z' || k === 'Z')) || k === 'u') { e.preventDefault(); this.undo(); return; }
    if (e.ctrlKey) return;
    if (k >= '1' && k <= '9') { this.input(+k); e.preventDefault(); return; }
    if (k === 'Backspace' || k === 'Delete' || k === '0') { this.erase(); e.preventDefault(); return; }
    if (k === 'n' || k === 'N') { this.toggleNotes(); return; }
    if (k === 'h' || k === 'H') { this.showHint(); return; }
    if (k === ' ' || k === 'p') { e.preventDefault(); this.setPaused(!this.game.paused); return; }
    if (k === 'Escape') { if (this.hint) this.closeHint(); else { this.sel = null; this.focusDigit = 0; this.render(); } return; }
    const dir = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 }[k];
    if (dir) {
      e.preventDefault();
      let i = this.sel == null ? 40 : this.sel;
      const r = Math.floor(i / 9), c = i % 9;
      if (dir === -9) i = ((r + 8) % 9) * 9 + c;
      if (dir === 9) i = ((r + 1) % 9) * 9 + c;
      if (dir === -1) i = r * 9 + (c + 8) % 9;
      if (dir === 1) i = r * 9 + (c + 1) % 9;
      this._cellTap(i, 'key');
    }
  }

  // ---------- Tipps ----------

  showHint() {
    const g = this.game;
    if (g.done || g.paused) return;
    if (this.hint) { this.closeHint(); return; }
    const hint = findHint(g);
    if (!hint) return;
    // Derselbe Tipp (nochmals geöffnet) zählt nur einmal
    const key = hintKey(hint);
    if (g.meta.lastHint !== key) { g.hints++; g.meta.lastHint = key; }
    sfx.play('sparkle');
    this.hint = hint;
    let title = '', text = '', action = null;
    if (hint.type === 'wrong') {
      ({ title, text } = hintTexts.wrong);
      action = hintTexts.wrongAction;
      this.sel = hint.cell;
    } else if (hint.type === 'reveal') {
      ({ title, text } = hintTexts.reveal(hint.digit));
      action = hintTexts.placeAction;
      this.sel = hint.cell;
    } else {
      ({ title, text } = describeStep(hint.step));
      action = hint.step.place ? hintTexts.placeAction : hintTexts.elimAction;
      this.sel = hint.step.place ? hint.step.place.c : null;
    }
    this.focusDigit = 0;
    this.hintTitle.textContent = title;
    this.hintText.textContent = text;
    this.hintAction.textContent = action;
    // Tipp-Karte ersetzt Werkzeuge und Zahlenfeld (mindestens gleich hoch, damit nichts springt)
    this.hintCard.style.minHeight = this.controls.offsetHeight + 'px';
    this.controls.classList.add('hinting');
    this.render();
    this.save();
  }

  closeHint() {
    if (!this.hint) return;
    this.hint = null;
    this.controls.classList.remove('hinting');
    this.render();
  }

  _hintAct() {
    const hint = this.hint;
    if (!hint) return;
    this.closeHint();
    const g = this.game;
    if (hint.type === 'wrong') {
      this.sel = hint.cell;
      this.erase();
    } else if (hint.type === 'reveal') {
      this.sel = hint.cell;
      this.place(hint.cell, hint.digit);
    } else if (hint.step.place) {
      this.sel = hint.step.place.c;
      this.place(hint.step.place.c, hint.step.place.d);
    } else {
      const r = g.applyEliminations(hint.step.elims, hint.step.cells);
      sfx.play('whoosh');
      this.render();
      if (r) r.cells.forEach((c) => this.board.noteIn(c));
      toast('Notizen angepasst');
      this.save();
    }
  }

  // ---------- Darstellung ----------

  render() {
    const g = this.game;
    const s = this.settings;
    const flags = Array.from({ length: 81 }, () => new Set());
    const conflicts = g.conflicts();
    const sel = this.sel;
    const digit = this.focusDigit || (sel != null ? g.values[sel] : 0) || 0;
    const hint = this.hint;

    for (let i = 0; i < 81; i++) {
      const f = flags[i];
      if (g.given[i]) f.add('given'); else if (g.values[i]) f.add('user');
      if (conflicts.has(i) && !g.given[i]) f.add('conflict');
      if (s.showMistakes && g.isWrong(i)) f.add('wrong');
      if (!hint && s.hlSame && digit && g.values[i] === digit) f.add('same');
    }
    if (!hint && sel != null) {
      if (s.hlUnits) for (const u of CELL_UNITS[sel]) for (const j of UNITS[u]) flags[j].add('peer');
      flags[sel].add('sel');
    }

    let virtualNotes = null, elimMask = null, hlNotes = null;
    if (hint) {
      if (hint.type === 'wrong') {
        flags[hint.cell].add('h-bad');
      } else if (hint.type === 'reveal') {
        flags[hint.cell].add('h-focus');
      } else {
        const st = hint.step;
        for (const u of st.units) for (const j of UNITS[u]) flags[j].add('h-unit');
        if (st.place) {
          flags[st.place.c].add('h-focus');
          for (const b of hint.blockers) flags[b].add('h-block');
        } else {
          // Muster und Streichungen mit (ggf. virtuellen) Notizen zeigen
          const cands = candidatesFromValues(g.values);
          virtualNotes = new Map();
          elimMask = new Map();
          hlNotes = new Map();
          let dm = 0;
          for (const d of st.digits) dm |= bit(d);
          for (const c of st.cells) {
            flags[c].add('h-pattern');
            virtualNotes.set(c, cands[c] & ~g.elims[c]);
            hlNotes.set(c, dm);
          }
          for (const { c, d } of st.elims) {
            virtualNotes.set(c, cands[c] & ~g.elims[c]);
            elimMask.set(c, (elimMask.get(c) || 0) | bit(d));
          }
        }
      }
    }

    this.board.paint({
      values: g.values,
      notes: g.notes,
      flags,
      noteHl: hint ? 0 : digit,
      virtualNotes,
      elimMask,
      hlNotes,
    });

    // Fortschritt
    const pct = Math.round(g.progress() * 100);
    this.stripPct.textContent = `${pct} %`;
    this.stripBar.style.width = pct + '%';

    // Kopfzeile
    const lim = g.mistakeLimit;
    this.subEl.textContent = s.threeStrikes ? `Fehler ${Math.min(g.mistakes, lim)}/${lim}` : `Fehler: ${g.mistakes}`;
    this.subEl.classList.toggle('warn', s.threeStrikes && g.mistakes >= lim - 1 && g.mistakes > 0);

    // Werkzeuge
    this.notesBtn.classList.toggle('on', this.notesMode);
    this.notesBadge.textContent = this.notesMode ? 'AN' : 'AUS';
    this.pad.classList.toggle('notes', this.notesMode);
    this.undoBtn.classList.toggle('dim', !g.canUndo());
    this.hintBtn.classList.toggle('on', !!hint);

    // Zahlenfeld
    const counts = g.counts();
    const selNotes = sel != null && !g.values[sel] ? g.notes[sel] : 0;
    for (let d = 1; d <= 9; d++) {
      const { b, cnt } = this.padBtns[d - 1];
      const left = Math.max(0, 9 - counts[d]);
      const gone = s.hideDone && left === 0;
      b.classList.toggle('gone', gone);
      b.classList.toggle('noted', this.notesMode && !!(selNotes & bit(d)));
      b.classList.toggle('focus', !this.notesMode && digit === d);
      const t = left ? String(left) : '';
      if (cnt.textContent !== t) cnt.textContent = t;
    }
    this.el.classList.toggle('is-paused', !!g.paused);
    this.el.classList.toggle('is-done', !!g.done);
  }

  // ---------- Ende ----------

  _strikeOut() {
    return this.settings.threeStrikes && !this.game.done && this.game.mistakes >= this.game.mistakeLimit;
  }

  async _gameOver() {
    if (this.destroyed || !this._strikeOut()) return;
    this.modalOpen = true;
    this.locked = true;
    sfx.play('thud');
    const ic = h('div.sheet-ic.sad');
    ic.innerHTML = icon('heartbreak', { size: 40 });
    const v = await showModal({
      title: 'Drei Fehler',
      content: h('div', null, ic, h('p', null, 'Kein Problem – das passiert den Besten. Wie möchtest du weitermachen?')),
      buttons: [
        { label: 'Zweite Chance', value: 'again', primary: true, icon: 'heart' },
        { label: 'Nochmal von vorn', value: 'restart', icon: 'refresh' },
        { label: 'Neues Rätsel', value: 'new', ghost: true },
      ],
      dismissible: false,
    });
    this.modalOpen = false;
    this.locked = false;
    this._lastTick = performance.now();
    const g = this.game;
    if (v === 'again') {
      // Letzten falschen Eintrag zurücknehmen und ein Leben dazu
      const last = g.history[g.history.length - 1];
      if (last && last.k === 'set') g.undo();
      g.extraLives++;
      toast('Weiter geht’s!');
    } else if (v === 'restart') {
      g.restart();
      this.sel = null;
      this.focusDigit = 0;
      toast('Neuer Anlauf');
    } else {
      this.o.onGiveUp();
      return;
    }
    this.render();
    this.save();
  }

  async _win() {
    const g = this.game;
    this.locked = true;
    this.sel = null;
    this.focusDigit = 0;
    this.closeHint();
    this.render();
    this._updateTimer();
    this.save();
    await sleep(380);
    this.board.winWave();
    sfx.play('complete');
    await sleep(1200);
    if (this.destroyed) return;
    this.locked = false;
    this._showDone(true);
    this.modalOpen = true;
    await this.o.onWin(g, this._winInfo);
    this.modalOpen = false;
  }

  _showDone() {
    const g = this.game;
    const ic = h('span.done-ic');
    ic.innerHTML = icon('check', { size: 22, stroke: 3 });
    const next = h('button.btn.primary', { type: 'button' }, this.o.nextLabel ? this.o.nextLabel() : 'Nächstes Rätsel');
    next.addEventListener('click', () => { sfx.play('click'); this.o.onNext(); });
    const menu = h('button.btn', { type: 'button' }, 'Menü');
    menu.addEventListener('click', () => { sfx.play('click'); this.o.onMenu(); });
    this.donePanel.replaceChildren(
      h('div.done-line', null, ic, h('span', null, 'Gelöst in ', h('b', null, formatTime(g.elapsed)))),
      h('div.done-btns', null, menu, next));
    this.el.classList.add('is-done');
  }
}

/** Kennung eines Tipps (gleicher Tipp => gleicher Schlüssel). */
function hintKey(hint) {
  if (hint.type === 'wrong') return `w${hint.cell}`;
  if (hint.type === 'reveal') return `r${hint.cell}:${hint.digit}`;
  const st = hint.step;
  if (st.place) return `p${st.place.c}:${st.place.d}`;
  return `e${st.tech}:` + st.elims.map(({ c, d }) => c * 10 + d).sort((a, b) => a - b).join(',');
}

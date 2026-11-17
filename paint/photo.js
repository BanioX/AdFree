// «Eigenes Foto»: Foto wählen (Kamera oder Mediathek), Optionen, Umwandlung mit Fortschritt,
// Vorschau und «Ausmalen». Benutzt photoToPuzzle aus /paint/gen/index.js.

import { icon, h, toast } from '../shared/ui.js';
import { sfx } from '../shared/sfx.js';
import { store } from '../shared/storage.js';
import { sanitizePuzzle } from './engine/model.js';
import { liteModel, renderThumb } from './engine/render.js';

const DETAILS = [['grob', 'Grob'], ['mittel', 'Mittel'], ['fein', 'Fein']];

export function openPhotoSheet(lib) {
  return new Promise((resolve) => {
    if (!lib.photoToPuzzle) { resolve(null); return; }
    const opts = store.get('paint.photoOpts', { colors: 16, detail: 'mittel' });
    let colors = Math.min(24, Math.max(8, opts.colors | 0 || 16));
    let detail = DETAILS.some((d) => d[0] === opts.detail) ? opts.detail : 'mittel';
    let file = null;
    let puzzle = null;
    let ctrl = null;
    let reTimer = 0;
    let closed = false;
    let runId = 0;

    const input = h('input.hidden', { type: 'file', accept: 'image/*' });
    const preview = h('div.ph-preview');
    const pick = h('div.ph-pick', null,
      h('span.ph-pick-ic', { html: icon('camera', { size: 34 }) }),
      h('b', null, 'Foto wählen'),
      h('small', null, 'Kamera oder Fotomediathek'));
    const progText = h('span.ph-prog-t', null, '0 %');
    const progFill = h('span.ph-prog-fill');
    const prog = h('div.ph-prog.hidden', null, h('div.ph-prog-bar', null, progFill), progText);
    const area = h('button.ph-area', { type: 'button', 'aria-label': 'Foto wählen' }, pick, preview, prog);
    const info = h('p.ph-info', null, 'Aus deinem Foto wird ein Malbild mit Nummern.');

    const valEl = h('b.ph-val', null, String(colors));
    const range = h('input.ph-range', { type: 'range', min: '8', max: '24', step: '1', value: String(colors), 'aria-label': 'Anzahl Farben' });
    const seg = h('div.ph-seg', { role: 'radiogroup', 'aria-label': 'Detail' });
    const segBtns = DETAILS.map(([v, label]) => {
      const b = h('button' + (v === detail ? '.on' : ''), { type: 'button', role: 'radio', 'aria-checked': v === detail ? 'true' : 'false' }, label);
      b.addEventListener('click', () => {
        if (detail === v) return;
        sfx.play('click');
        detail = v;
        segBtns.forEach((x, k) => {
          const on = DETAILS[k][0] === v;
          x.classList.toggle('on', on);
          x.setAttribute('aria-checked', on ? 'true' : 'false');
        });
        optsChanged();
      });
      seg.append(b);
      return b;
    });
    const options = h('div.ph-opts', null,
      h('div.ph-row', null, h('span', null, 'Farben'), valEl),
      range,
      h('div.ph-row', null, h('span', null, 'Detail')),
      seg);

    const go = h('button.btn.primary.block', { type: 'button', disabled: true, html: icon('sparkle', { size: 20 }) + 'Ausmalen' });
    const cancel = h('button.btn.ghost.block', { type: 'button' }, 'Abbrechen');
    const modal = h('div.sp-modal.ph-sheet', { role: 'dialog', 'aria-modal': 'true' },
      h('h2', null, 'Eigenes Foto'),
      area, info, options,
      h('div.sp-modal-buttons', null, go, cancel),
      input);
    const backdrop = h('div.sp-modal-backdrop', null, modal);

    function finish(value) {
      if (closed) return;
      closed = true;
      if (ctrl) ctrl.abort();
      clearTimeout(reTimer);
      backdrop.classList.remove('show');
      setTimeout(() => backdrop.remove(), 260);
      resolve(value);
    }

    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) finish(null); });
    cancel.addEventListener('click', () => { sfx.play('click'); finish(null); });
    area.addEventListener('click', () => { sfx.play('tap'); input.value = ''; input.click(); });
    input.addEventListener('change', () => {
      const f = input.files && input.files[0];
      if (!f) return;
      file = f;
      convert();
    });
    range.addEventListener('input', () => { colors = +range.value; valEl.textContent = String(colors); optsChanged(); });

    function optsChanged() {
      store.set('paint.photoOpts', { colors, detail });
      if (!file) return;
      clearTimeout(reTimer);
      reTimer = setTimeout(convert, 380);
    }

    async function convert() {
      if (!file || closed) return;
      if (ctrl) ctrl.abort();
      ctrl = new AbortController();
      const my = ++runId;
      const signal = ctrl.signal;
      go.disabled = true;
      puzzle = null;
      area.classList.add('busy');
      prog.classList.remove('hidden');
      progFill.style.width = '0%';
      progText.textContent = 'Wird umgewandelt …';
      info.textContent = 'Das dauert einen Moment.';
      try {
        const pz = await lib.photoToPuzzle(file, {
          colors, detail, signal,
          onProgress: (p) => {
            if (my !== runId) return;
            const v = Math.round(Math.max(0, Math.min(1, p)) * 100);
            progFill.style.width = v + '%';
            progText.textContent = v + ' %';
          },
        });
        if (my !== runId || closed) return;
        const clean = sanitizePuzzle(pz, 'foto');
        puzzle = clean;
        const cv = renderThumb(liteModel(clean), null, true, 720);
        cv.className = 'ph-canvas';
        preview.innerHTML = '';
        preview.append(cv);
        area.classList.add('has-preview');
        info.textContent = `${clean.shapes.length} Flächen · ${clean.palette.length} Farben – tippe aufs Bild für ein anderes Foto.`;
        go.disabled = false;
        sfx.play('pop');
      } catch (err) {
        if (my !== runId || closed || (err && err.name === 'AbortError')) return;
        info.textContent = 'Das Foto konnte nicht umgewandelt werden. Versuch es mit einem anderen.';
        toast('Das hat leider nicht geklappt.');
      } finally {
        if (my === runId) {
          area.classList.remove('busy');
          prog.classList.add('hidden');
        }
      }
    }

    go.addEventListener('click', async () => {
      if (!puzzle || go.disabled) return;
      go.disabled = true;
      sfx.play('click');
      try {
        const item = await lib.addPhoto(puzzle);
        finish(item);
      } catch {
        go.disabled = false;
        toast('Speichern hat nicht geklappt.');
      }
    });

    document.body.append(backdrop);
    requestAnimationFrame(() => backdrop.classList.add('show'));
  });
}

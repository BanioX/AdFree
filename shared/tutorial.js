// Einheitliches, kurzes Tutorial («So geht's») für alle Spiele.
// 3–4 Schritte, jeder mit einer kleinen animierten Demo (Finger tippt / wischt),
// Titel und einem kurzen Satz. Wischen oder «Weiter», «Überspringen» oben rechts.
//
//   import { showTutorial, maybeShowTutorial } from '../shared/tutorial.js';
//   const steps = [
//     {
//       title: 'Pfeil antippen',
//       text: 'Ist der Weg frei, gleitet der Pfeil hinaus.',
//       demo(stage, api) {               // optional: animierte Mini-Szene
//         const box = h('div.my-demo'); stage.append(box);
//         return api.loop(async () => {   // läuft, bis der Schritt gewechselt wird
//           await api.finger.tap(box);   // Element oder {x, y} in % der Bühne
//           box.classList.add('gone');
//           await api.sleep(900);
//           box.classList.remove('gone');
//         });
//       },
//     },
//     { title: '…', text: '…', art: '<svg …>' },   // oder statisches Bild (SVG/HTML-String)
//   ];
//   maybeShowTutorial({ id: 'cube', steps });  // nur beim ersten Start
//   showTutorial({ id: 'cube', steps });       // jederzeit (z.B. über den «?»-Knopf)

import { h, icon } from './ui.js';
import { store } from './storage.js';
import { sfx } from './sfx.js';

const FINGER_SVG = `<svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
  <path d="M19 6.5c2 0 3.5 1.5 3.5 3.5v13.2l1.3-.3c.3-1.6 1.7-2.7 3.4-2.7 1.4 0 2.6.8 3.1 2 .6-.6 1.5-1 2.5-1 1.6 0 2.9 1 3.3 2.5.5-.3 1.1-.4 1.7-.4 1.9 0 3.4 1.5 3.4 3.4V34c0 6-4.6 10.5-10.6 10.5h-3.6c-3.6 0-6.3-1.3-8.4-4.1l-7.3-9.6c-1.1-1.5-.8-3.6.7-4.7 1.4-1 3.3-.8 4.4.4l2.2 2.4V10c0-2 1.5-3.5 3.4-3.5z"
    fill="#fff" stroke="#3a2a2a" stroke-width="2.2" stroke-linejoin="round"/>
</svg>`;

export function tutorialSeen(id) {
  return store.get(`tutorial.${id}`, false) === true;
}
export function markTutorialSeen(id) {
  store.set(`tutorial.${id}`, true);
}

/** Zeigt das Tutorial nur, wenn es für dieses Spiel noch nie gezeigt wurde. */
export function maybeShowTutorial(opts) {
  if (tutorialSeen(opts.id)) return Promise.resolve(false);
  return showTutorial(opts).then(() => true);
}

/**
 * opts: { id, steps, accent?, title? ('So geht\'s'), doneLabel? ('Los geht\'s') }
 * Gibt ein Promise zurück, das beim Schliessen erfüllt wird.
 */
export function showTutorial(opts) {
  const { id, steps } = opts;
  const doneLabel = opts.doneLabel || 'Los geht’s';
  return new Promise((resolve) => {
    let index = 0;
    let controller = null;
    let closed = false;

    const stage = h('div.tut-stage');
    const titleEl = h('h2.tut-title');
    const textEl = h('p.tut-text');
    const dots = h('div.tut-dots', null, steps.map(() => h('span')));
    const nextBtn = h('button.btn.primary.tut-next', { type: 'button' });
    const backBtn = h('button.tut-back', { type: 'button', 'aria-label': 'Zurück' });
    backBtn.innerHTML = icon('back', { size: 22 });
    const skipBtn = h('button.tut-skip', { type: 'button' }, 'Überspringen');
    const head = h('div.tut-head', null, backBtn, h('span.tut-kicker', null, opts.title || 'So geht’s'), skipBtn);
    const card = h('div.tut-card', { role: 'dialog', 'aria-modal': 'true' },
      head, stage, h('div.tut-body', null, titleEl, textEl), dots, nextBtn);
    const root = h('div.tut-backdrop', null, card);
    if (opts.accent) root.style.setProperty('--accent', opts.accent);

    function close() {
      if (closed) return;
      closed = true;
      if (controller) controller.abort();
      markTutorialSeen(id);
      root.classList.remove('show');
      setTimeout(() => root.remove(), 280);
      document.removeEventListener('keydown', onKey);
      resolve();
    }

    function render(dir = 0) {
      if (controller) controller.abort();
      controller = new AbortController();
      const step = steps[index];
      stage.replaceChildren();
      stage.className = 'tut-stage' + (dir ? (dir > 0 ? ' in-right' : ' in-left') : '');
      void stage.offsetWidth;
      stage.classList.add('in');
      titleEl.textContent = step.title || '';
      textEl.textContent = step.text || '';
      [...dots.children].forEach((d, i) => d.classList.toggle('on', i === index));
      nextBtn.textContent = index === steps.length - 1 ? doneLabel : 'Weiter';
      backBtn.style.visibility = index === 0 ? 'hidden' : 'visible';
      skipBtn.style.visibility = index === steps.length - 1 ? 'hidden' : 'visible';
      if (typeof step.demo === 'function') {
        const api = makeApi(stage, controller.signal);
        try {
          const r = step.demo(stage, api);
          if (r && typeof r.catch === 'function') r.catch(() => {});
        } catch (e) {
          console.warn('Tutorial-Demo fehlgeschlagen', e);
        }
      } else if (step.art) {
        const art = h('div.tut-art');
        if (typeof step.art === 'string') art.innerHTML = step.art; else art.append(step.art);
        stage.append(art);
      }
    }

    function go(delta) {
      const n = index + delta;
      if (n < 0) return;
      if (n >= steps.length) { sfx.play('pop'); close(); return; }
      index = n;
      sfx.play('click');
      render(delta);
    }

    nextBtn.addEventListener('click', () => go(1));
    backBtn.addEventListener('click', () => go(-1));
    skipBtn.addEventListener('click', () => { sfx.play('click'); close(); });

    // Wischen zwischen den Schritten
    let sx = 0, sy = 0, tracking = false;
    card.addEventListener('pointerdown', (e) => { tracking = true; sx = e.clientX; sy = e.clientY; });
    card.addEventListener('pointerup', (e) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1);
    });
    card.addEventListener('pointercancel', () => { tracking = false; });

    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKey);

    document.body.append(root);
    render(0);
    requestAnimationFrame(() => root.classList.add('show'));
  });
}

// ---------- Demo-API: Finger, Warten, Schleifen ----------

function makeApi(stage, signal) {
  const finger = h('div.tut-finger', { html: FINGER_SVG });
  const ripple = h('div.tut-ripple');
  stage.append(ripple, finger);
  let pos = { x: 70, y: 80 };
  place(pos, 0);

  function sleep(ms) {
    return new Promise((res, rej) => {
      if (signal.aborted) return rej(abortErr());
      const t = setTimeout(res, ms);
      signal.addEventListener('abort', () => { clearTimeout(t); rej(abortErr()); }, { once: true });
    });
  }

  function toPoint(target) {
    if (target && target.nodeType === 1) {
      const s = stage.getBoundingClientRect();
      const r = target.getBoundingClientRect();
      if (!s.width || !s.height) return { x: 50, y: 50 };
      return { x: ((r.left + r.width / 2 - s.left) / s.width) * 100, y: ((r.top + r.height / 2 - s.top) / s.height) * 100 };
    }
    return { x: target.x, y: target.y };
  }

  function place(p, ms) {
    finger.style.transition = ms ? `left ${ms}ms cubic-bezier(.45,.05,.3,1), top ${ms}ms cubic-bezier(.45,.05,.3,1)` : 'none';
    finger.style.left = p.x + '%';
    finger.style.top = p.y + '%';
    pos = p;
  }

  const api = {
    signal,
    sleep,
    finger: {
      show() { finger.classList.remove('hidden'); },
      hide() { finger.classList.add('hidden'); },
      async moveTo(target, ms = 600) {
        finger.classList.remove('hidden');
        const p = toPoint(target);
        place(p, ms);
        await sleep(ms);
      },
      async press(ms = 220) {
        finger.classList.add('down');
        ripple.style.left = pos.x + '%';
        ripple.style.top = pos.y + '%';
        ripple.classList.remove('go');
        void ripple.offsetWidth;
        ripple.classList.add('go');
        await sleep(ms);
        finger.classList.remove('down');
      },
      /** Bewegt den Finger zum Ziel und tippt. */
      async tap(target, moveMs = 600) {
        await api.finger.moveTo(target, moveMs);
        await sleep(120);
        await api.finger.press();
      },
      /** Zieht mit gedrücktem Finger durch die Punkte/Elemente. */
      async drag(targets, ms = 900, onPoint) {
        const pts = targets.map(toPoint);
        await api.finger.moveTo(pts[0], 500);
        finger.classList.add('down');
        await sleep(150);
        const per = ms / Math.max(1, pts.length - 1);
        for (let i = 1; i < pts.length; i++) {
          place(pts[i], per);
          await sleep(per);
          if (onPoint) onPoint(i, pts[i]);
        }
        await sleep(120);
        finger.classList.remove('down');
      },
    },
    /** Wiederholt fn, bis der Schritt gewechselt wird. */
    async loop(fn, pause = 700) {
      try {
        while (!signal.aborted) {
          await fn();
          await sleep(pause);
        }
      } catch (e) {
        if (e && e.name !== 'AbortError') console.warn(e);
      }
    },
  };
  return api;
}

function abortErr() {
  const e = new Error('abgebrochen');
  e.name = 'AbortError';
  return e;
}

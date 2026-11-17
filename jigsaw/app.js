// Puzzle – Einstieg: Hash-Routing, Startbildschirm mit Packs, eigene Fotos, Statistik, Gewinn-Blatt.
//
// Routen:  ''            → Startbildschirm
//          #play/<slot>  → Puzzle (slot = Bildschlüssel@Teile[r], z.B. 'berge/alpenglut@48')

import { setupPage, h, icon, toast, showModal, confirmDialog } from '../shared/ui.js';
import { gameMenu, menuSection } from '../shared/gamemenu.js';
import { maybeShowTutorial, showTutorial } from '../shared/tutorial.js';
import { reportSummary, todayKey } from '../shared/storage.js';
import { sfx } from '../shared/sfx.js';
import { TIERS, formatTime, recordWin } from './logic.js';
import * as IM from './images.js';
import * as SV from './saves.js';
import { createPlay } from './play.js';
import { howtoSteps } from './howto.js';

setupPage();

const ID = 'jigsaw';
const ACCENT = '#9a6b4f';
const app = document.getElementById('app');
document.documentElement.style.setProperty('--accent', ACCENT);

let play = null;
let menu = null;
let routeToken = 0;

const tutorial = (force) => (force ? showTutorial : maybeShowTutorial)({ id: ID, steps: howtoSteps, accent: ACCENT });

function go(hash) {
  const target = hash ? '#' + hash : location.pathname + location.search;
  if (hash) location.hash = hash;
  else { history.pushState(null, '', target); route(); }
}

function closePlay() {
  if (play) { play.destroy(); play = null; }
  window.__jigsaw = null;
}

async function route() {
  const token = ++routeToken;
  const hash = decodeURIComponent(location.hash.slice(1));
  if (hash.startsWith('play/')) {
    const slot = hash.slice(5);
    await openPlay(slot, token);
  } else {
    closePlay();
    await showMenu(token);
  }
}

// ---------- Hilfen ----------

function getTier() {
  const t = SV.getPref('tier', 24);
  return TIERS.includes(t) ? t : 24;
}

function allBuiltin() {
  return IM.builtinPacks();
}

/** Nächstes noch nicht gelöstes Bild in `list` nach `afterKey` (ringsum); `null`, wenn alle gelöst sind. */
function nextUnsolved(list, afterKey, tier) {
  const done = SV.doneMap();
  const start = Math.max(0, list.findIndex((d) => d.key === afterKey) + 1);
  for (let n = 0; n < list.length; n++) {
    const d = list[(start + n) % list.length];
    if (d.key !== afterKey && !(done[d.key] || []).includes(tier)) return d;
  }
  return null;
}

/** Nach einem Farbenzauber-Bild: das nächste Bild im selben Pack (Zufallsbild erst, wenn das Pack fertig ist). */
async function nextPaintImage(desc, tier) {
  const packs = await IM.paintPacks().catch(() => []);
  const pack = packs.find((p) => p.id === desc.packId) || packs.find((p) => p.images.some((d) => d.key === desc.key));
  return pack ? nextUnsolved(pack.images, desc.key, tier) : null;
}

function nextImage(afterKey, tier) {
  const flat = allBuiltin().flatMap((p) => p.images);
  return nextUnsolved(flat, afterKey, tier) || flat[Math.max(0, flat.findIndex((d) => d.key === afterKey) + 1) % flat.length];
}

function startImage(key, tier = getTier(), rotate = SV.getPref('rotate', false)) {
  // vorhandenen Spielstand fortsetzen, sonst neu
  go('play/' + SV.slotFor(key, tier, rotate));
}

function summary() {
  const st = SV.getStats();
  const cur = SV.currentSave();
  if (cur) reportSummary(ID, `${cur.title}: ${cur.placed}/${cur.total} Teile`);
  else if (st.won) reportSummary(ID, `${st.won} ${st.won === 1 ? 'Puzzle' : 'Puzzles'} gelegt`);
}

// ---------- Vorschaubilder ----------

const thumbQueue = [];
let thumbBusy = false;
const io = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
  for (const en of entries) {
    if (!en.isIntersecting) continue;
    io.unobserve(en.target);
    const job = en.target._thumbJob;
    if (job) { thumbQueue.unshift(job); pumpThumbs(); }
  }
}, { rootMargin: '200px' }) : null;

function pumpThumbs() {
  if (thumbBusy || !thumbQueue.length) return;
  thumbBusy = true;
  const job = thumbQueue.shift();
  IM.thumbFor(job.desc, 240).then((url) => { job.img.src = url; job.img.classList.add('ok'); })
    .catch(() => { job.el.classList.add('broken'); })
    .finally(() => { thumbBusy = false; setTimeout(pumpThumbs, 0); });
}

function lazyThumb(el, img, desc) {
  const job = { el, img, desc };
  if (io) { el._thumbJob = job; io.observe(el); } else { thumbQueue.push(job); pumpThumbs(); }
}

function badgeFor(key, tier) {
  const done = SV.doneTiers(key);
  const saves = SV.listSaves().filter((s) => s.key === key);
  const wrap = h('div.pz-badges');
  if (done.length) {
    const best = Math.max(...done);
    wrap.append(h('span.pz-badge.done' + (done.includes(tier) ? '.cur' : ''), { title: 'Gelöst mit ' + done.join(', ') + ' Teilen' },
      h('span', { html: icon('check', { size: 12 }) }), String(best)));
  }
  const sv = saves.find((s) => s.tier === tier) || saves[0];
  if (sv) wrap.append(h('span.pz-badge.prog', null, Math.floor((sv.placed / sv.total) * 100) + '%'));
  return wrap;
}

function tile(desc, tier, { onDelete, onClick, label } = {}) {
  const img = h('img', { alt: '', draggable: 'false' });
  const el = h('button.pz-tile', { type: 'button', 'aria-label': desc.title, 'data-key': desc.key },
    h('div.pz-tile-pic', null, img, badgeFor(desc.key, tier)),
    h('span.pz-tile-name', null, label || desc.title));
  el.addEventListener('click', () => {
    if (el.closest('.editing') && onDelete) { onDelete(); return; }
    sfx.play('tap');
    if (onClick) onClick(); else startImage(desc.key);
  });
  if (onDelete) el.append(h('span.pz-del', { html: icon('close', { size: 14 }) }));
  if (desc.thumb) { img.src = desc.thumb; img.classList.add('ok'); } else lazyThumb(el, img, desc);
  return el;
}

function packRow(pack, tier) {
  const done = SV.doneMap();
  const solved = pack.images.filter((d) => (done[d.key] || []).length).length;
  const head = h('div.pz-pack-head', null,
    h('span.pz-pack-emoji', null, pack.emoji || '🧩'),
    h('span.pz-pack-title', null, pack.title),
    pack.source ? h('span.pz-pack-src', null, pack.source) : null,
    h('span.pz-pack-count', null, `${solved}/${pack.images.length}`));
  const row = h('div.pz-row', null, pack.images.map((d) => tile(d, tier)));
  return h('section.pz-pack', null, head, row);
}

// ---------- Eigenes Foto ----------

let fileInput = null;
function pickPhoto() {
  if (!fileInput) {
    fileInput = h('input', { type: 'file', accept: 'image/*', style: { display: 'none' } });
    document.body.append(fileInput);
    fileInput.addEventListener('change', async () => {
      const f = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (!f) return;
      toast('Foto wird geladen …');
      try {
        const d = await IM.importPhoto(f);
        sfx.play('pop');
        startImage(d.key);
      } catch {
        toast('Dieses Foto konnte nicht gelesen werden.');
      }
    });
  }
  fileInput.click();
}

async function photoSection(tier) {
  const photos = await IM.listPhotos();
  const add = h('button.pz-tile.pz-add', { type: 'button', 'aria-label': 'Eigenes Foto hinzufügen' },
    h('div.pz-tile-pic', { html: icon('camera', { size: 30 }) }), h('span.pz-tile-name', null, 'Foto wählen'));
  add.addEventListener('click', () => { sfx.play('click'); pickPhoto(); });
  const row = h('div.pz-row');
  const editBtn = photos.length ? h('button.pz-edit', { type: 'button' }, 'Bearbeiten') : null;
  const sec = h('section.pz-pack', null,
    h('div.pz-pack-head', null, h('span.pz-pack-emoji', null, '📷'), h('span.pz-pack-title', null, 'Meine Fotos'), editBtn), row);
  row.append(add, ...photos.map((e) => tile(IM.photoDesc(e), tier, {
    onDelete: async () => {
      const ok = await confirmDialog('Foto löschen?', `«${e.title}» wird aus dem Puzzle entfernt.`, 'Löschen');
      if (!ok) return;
      await IM.deletePhoto(e.id);
      for (const s of SV.listSaves()) if (s.key === `foto/${e.id}`) SV.dropSave(s.slot);
      route();
    },
  })));
  if (editBtn) editBtn.addEventListener('click', () => {
    sfx.play('click');
    const on = sec.classList.toggle('editing');
    editBtn.textContent = on ? 'Fertig' : 'Bearbeiten';
  });
  return sec;
}

// ---------- Startbildschirm ----------

function statsList(tier) {
  const st = SV.getStats();
  const best = st.best && st.best[tier];
  return [
    { label: 'Gelegt', value: st.won || 0 },
    { label: 'Teile', value: st.pieces || 0 },
    { label: `Bestzeit ${tier}`, value: best ? formatTime(best) : '–' },
    { label: 'Tage am Stück', value: (st.days && st.days.count) || 0 },
  ];
}

function primaryFor(tier) {
  const cur = SV.currentSave();
  if (cur) {
    return {
      label: 'Weiterspielen',
      sub: `${cur.title} · ${cur.placed}/${cur.total} Teile`,
      onClick: () => go('play/' + cur.slot),
    };
  }
  const d = nextImage(null, tier);
  return { label: 'Spielen', sub: `${d.title} · ${tier} Teile`, onClick: () => startImage(d.key, tier) };
}

async function heroArt() {
  const cur = SV.currentSave();
  if (!cur) return null;
  const desc = await IM.resolveImage(cur.key).catch(() => null);
  if (!desc) return null;
  const img = h('img.pz-hero-img', { alt: '' });
  IM.thumbFor(desc, 240).then((u) => { img.src = u; }).catch(() => {});
  const pct = Math.round((cur.placed / cur.total) * 100);
  return h('div.pz-hero', null, img, h('div.pz-hero-piece', null, '🧩'), h('div.pz-hero-pct', null, pct + '%'));
}

async function showMenu(token) {
  const tier = getTier();
  const art = await heroArt();
  if (token !== routeToken) return;
  const rotate = SV.getPref('rotate', false);
  const rotToggle = h('button.pz-switch' + (rotate ? '.on' : ''), { type: 'button', role: 'switch', 'aria-checked': String(rotate) },
    h('span.pz-switch-text', null, h('b', null, 'Teile drehen'), h('small', null, 'Antippen dreht ein Teil – für Profis')), h('span.pz-knob'));
  rotToggle.addEventListener('click', () => {
    const v = !SV.getPref('rotate', false);
    SV.setPref('rotate', v);
    rotToggle.classList.toggle('on', v);
    rotToggle.setAttribute('aria-checked', String(v));
    sfx.play('click');
  });

  const sections = [h('div.pz-options', null, rotToggle)];
  const curSlot = (SV.currentSave() || {}).slot;
  const others = SV.listSaves().filter((s) => s.slot !== curSlot).slice(0, 8);
  if (others.length) {
    const row = h('div.pz-row');
    for (const s of others) {
      IM.resolveImage(s.key).then((d) => {
        if (!d) return;
        row.append(tile(d, s.tier, { label: `${s.tier} Teile · ${Math.floor((s.placed / s.total) * 100)}%`, onClick: () => go('play/' + s.slot) }));
      }).catch(() => {});
    }
    sections.push(menuSection('Angefangen', row));
  }
  const hasPhotos = (await IM.listPhotos()).length > 0;
  const photoSec = await photoSection(tier);
  if (token !== routeToken) return;
  if (hasPhotos) sections.push(photoSec);
  for (const p of allBuiltin()) sections.push(packRow(p, tier));
  if (!hasPhotos) sections.push(photoSec);
  const paintSlot = h('div.pz-paint-slot');
  sections.push(paintSlot);

  closePlay();
  menu = gameMenu({
    id: ID,
    title: 'Puzzle',
    tagline: 'Bilder Teil für Teil',
    accent: ACCENT,
    art,
    primary: primaryFor(tier),
    modes: {
      label: 'Anzahl Teile', value: String(tier),
      options: TIERS.map((t) => ({ id: String(t), label: String(t) })),
      onChange: (id) => {
        SV.setPref('tier', Number(id));
        const t = Number(id);
        menu.update({ primary: primaryFor(t), stats: statsList(t) });
        for (const el of app.querySelectorAll('.pz-tile[data-key]')) {
          const old = el.querySelector('.pz-badges');
          if (old) old.replaceWith(badgeFor(el.dataset.key, t));
        }
      },
    },
    secondary: [
      { label: 'Zufallsbild', icon: 'shuffle', onClick: () => startImage(`zufall/${IM.newRandomSeed()}`) },
      { label: 'Eigenes Foto', icon: 'camera', onClick: pickPhoto },
      { label: 'Statistik', icon: 'star', onClick: showStats },
    ],
    stats: statsList(tier),
    sections,
    onHelp: () => tutorial(true),
    backHref: '../',
  });
  menu.classList.add('pz-menu');
  app.replaceChildren(menu);
  summary();

  // Bilder aus «Farbenzauber» (optional, werden nachgeladen)
  IM.paintPacks().then((packs) => {
    if (token !== routeToken || !packs.length) return;
    paintSlot.replaceWith(h('div.pz-paint', null,
      h('h2.gm-section-title', null, 'Aus Farbenzauber'),
      ...packs.map((p) => packRow(p, tier))));
  }).catch(() => {});

  await tutorial(false);
}

// ---------- Spielen ----------

async function openPlay(slot, token) {
  const parsed = SV.parseSlot(slot);
  const desc = parsed ? await IM.resolveImage(parsed.key).catch(() => null) : null;
  if (token !== routeToken) return;
  if (!parsed || !desc || !TIERS.includes(parsed.tier)) {
    if (parsed) SV.dropSave(slot);
    toast('Dieses Bild gibt es nicht mehr.');
    history.replaceState(null, '', location.pathname + location.search);
    route();
    return;
  }
  closePlay();
  const firstEver = !SV.getStats().won && !SV.listSaves().length;
  const saved = SV.loadSave(slot);
  if (!saved) await tutorial(false);
  if (token !== routeToken) return;
  let solvedInfo = null;
  play = createPlay(app, {
    desc,
    title: desc.title,
    slot,
    tier: parsed.tier,
    rotate: parsed.rotate,
    saved,
    coach: firstEver,
    prefs: { ghost: SV.getPref('ghost', true), filter: SV.getPref('filter', 'rand') },
    setPref: SV.setPref,
    onBack: () => go(''),
    onHelp: () => tutorial(true),
    onSave: (meta, data) => {
      if (data.done) return;
      SV.writeSave(slot, meta, data);
    },
    onSolved: (info) => { solvedInfo = onSolved(slot, parsed, info); },
    onWin: (info) => onWin(parsed, desc, info, solvedInfo),
    onError: () => {
      toast('Das Bild konnte nicht geladen werden.');
      SV.dropSave(slot);
      go('');
    },
  });
  window.__jigsaw = play.debug;
  if (!saved) {
    const st = SV.getStats();
    st.started = (st.started || 0) + 1;
    SV.setStats(st);
  }
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return todayKey(d);
}

/** Sofort beim Einrasten des letzten Teils: Stand löschen, Abzeichen und Statistik verbuchen. */
function onSolved(slot, parsed, info) {
  SV.dropSave(slot);
  // Neuladen (oder iOS beendet die App im Hintergrund) während Abschluss/Gewinn-Blatt: zurück ins Menü,
  // nicht dasselbe Bild von vorn
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  SV.markDone(parsed.key, parsed.tier);
  const res = recordWin(SV.getStats(), { tier: parsed.tier, ms: info.time, pieces: info.pieces, day: todayKey(), yesterday: yesterdayKey() });
  SV.setStats(res.stats);
  summary();
  return res;
}

/** Nach der Abschluss-Animation: Gewinn-Blatt. */
async function onWin(parsed, desc, info, solved) {
  const { stats, newBest } = solved || { stats: SV.getStats(), newBest: false };
  const pic = h('canvas.pz-win-pic');
  if (info.src) {
    const w = 220, hh = Math.round(w * info.src.height / info.src.width);
    pic.width = w * 2; pic.height = hh * 2;
    pic.getContext('2d').drawImage(info.src, 0, 0, pic.width, pic.height);
  }
  const best = stats.best[parsed.tier];
  const content = h('div.pz-win', null,
    h('div.pz-win-frame', null, pic),
    h('div.pz-win-title', null, desc.title),
    h('div.pz-win-stats', null,
      h('div.pz-win-stat', null, h('b', null, formatTime(info.time)), h('span', null, 'Zeit')),
      h('div.pz-win-stat', null, h('b', null, String(info.pieces)), h('span', null, 'Teile')),
      h('div.pz-win-stat', null, h('b', null, best ? formatTime(best) : '–'), h('span', null, 'Bestzeit'))),
    newBest ? h('p.pz-win-note', null, '🏆 Neue Bestzeit!') : null);
  const nextTier = TIERS[TIERS.indexOf(parsed.tier) + 1];
  const buttons = [{ label: 'Nächstes Bild', value: 'next', primary: true, icon: 'play' }];
  if (nextTier) buttons.push({ label: `Nochmal mit ${nextTier} Teilen`, value: 'more', icon: 'plus' });
  buttons.push({ label: 'Zum Menü', value: 'menu', ghost: true });
  const v = await showModal({ title: 'Geschafft!', content, buttons, dismissible: false });
  if (v === 'next') {
    const head = parsed.key.split('/')[0];
    let next = null;
    if (head === 'farben' || head === 'fgen') next = await nextPaintImage(desc, parsed.tier);
    else if (head !== 'zufall' && head !== 'foto') next = nextImage(parsed.key, parsed.tier);
    startImage(next ? next.key : `zufall/${IM.newRandomSeed()}`, parsed.tier, parsed.rotate);
  } else if (v === 'more') {
    SV.setPref('tier', nextTier);
    startImage(parsed.key, nextTier, parsed.rotate);
  } else if (location.hash) go('');
  else route();
}

// ---------- Statistik ----------

function showStats() {
  const st = SV.getStats();
  const rows = TIERS.map((t) => h('div.pz-st-row', null, h('span', null, `${t} Teile`), h('b', null, st.best && st.best[t] ? formatTime(st.best[t]) : '–')));
  const content = h('div.pz-stats', null,
    h('div.pz-win-stats', null,
      h('div.pz-win-stat', null, h('b', null, String(st.won || 0)), h('span', null, 'Gelegt')),
      h('div.pz-win-stat', null, h('b', null, String(st.pieces || 0)), h('span', null, 'Teile')),
      h('div.pz-win-stat', null, h('b', null, formatTime(st.time || 0)), h('span', null, 'Spielzeit'))),
    h('div.pz-win-stats', null,
      h('div.pz-win-stat', null, h('b', null, String(st.started || 0)), h('span', null, 'Begonnen')),
      h('div.pz-win-stat', null, h('b', null, String((st.days && st.days.count) || 0)), h('span', null, 'Tage am Stück')),
      h('div.pz-win-stat', null, h('b', null, String((st.days && st.days.max) || 0)), h('span', null, 'Längste Serie'))),
    h('div.pz-st-title', null, 'Bestzeiten'),
    h('div.pz-st-list', null, rows));
  showModal({ title: 'Statistik', content, buttons: [{ label: 'Schliessen', value: true, primary: true }] });
}

// ---------- Start ----------

window.addEventListener('hashchange', route);
window.addEventListener('popstate', route);
route();

// StackTable – CardTable mit Ziehen ganzer Kartengruppen (für Spalten-Patiencen wie Yukon,
// Skorpion, Bäckerdutzend). Das Spiel bestimmt Gruppe und Ziel selbst:
//
//   const t = new StackTable(el, {
//     onTap(id), onSlot(name), onBg(), onResize(),          // wie CardTable
//     dragGroup(id) -> [ids] | null      // welche Karten gehen mit? (erste = gefasste Karte)
//     dropTarget(ids, p) -> tgt | null   // p: { x, y } Mitte der gefassten Karte (Tisch-Koordinaten),
//                                        //    { fx, fy } Fingerposition
//                                        // tgt: { card } oder { slot } (für das Leuchten) + eigene Daten
//     onDrop(ids, tgt) -> bool           // false = Karten fliegen zurück
//   });
//
// Alles andere (Positionen, Animationen, Tipp-Leuchten, Coach-Ring, Fächer) erbt von CardTable.

import { CardTable } from './table.js';

export class StackTable extends CardTable {
  onMove(e) {
    const pr = this.press;
    if (!pr || e.pointerId !== pr.pid) return;
    const p = this.pos(e);
    const dx = p.x - pr.x, dy = p.y - pr.y;
    if (!this.drag) {
      if (Math.hypot(dx, dy) < 8) return;
      pr.moved = true;
      if (pr.id == null || pr.noDrag || !this.h.dragGroup) return;
      const ids = this.h.dragGroup(pr.id);
      if (!ids || !ids.length) { pr.noDrag = true; return; }
      for (const id of ids) {
        const an = this.anims.get(id);
        if (an) { this.finish(this.cards[id], an); this.anims.delete(id); }
      }
      const lead = this.cards[ids[0]];
      this.drag = {
        id: ids[0],
        ids,
        offs: ids.map((id) => ({ dx: this.cards[id].x - lead.x, dy: this.cards[id].y - lead.y })),
        ox: lead.x - pr.x,
        oy: lead.y - pr.y,
      };
      ids.forEach((id, i) => {
        const c = this.cards[id];
        c.el.classList.add('dragging');
        c.el.style.zIndex = 9000 + i;
      });
      this.select(null);
      this.coach(null);
      if (this.h.onDragStart) this.h.onDragStart(ids);
    }
    const d = this.drag;
    const x = p.x + d.ox, y = p.y + d.oy;
    d.ids.forEach((id, i) => {
      const c = this.cards[id];
      c.x = x + d.offs[i].dx;
      c.y = y + d.offs[i].dy;
      c.s = 1.04;
      this.apply(c);
    });
    const tgt = this.h.dropTarget ? this.h.dropTarget(d.ids, { x: x + this.cw / 2, y: y + this.ch / 2, fx: p.x, fy: p.y }) : null;
    d.tgt = tgt;
    this.glow(tgt && tgt.ok !== false ? tgt : null);
  }

  onUp(e) {
    const pr = this.press;
    if (!pr || e.pointerId !== pr.pid) return;
    this.press = null;
    if (this.drag) {
      const d = this.drag;
      d.ids.forEach((id) => this.cards[id].el.classList.remove('dragging'));
      this.drag = null;
      this.glow(null);
      const ok = this.h.onDrop ? this.h.onDrop(d.ids, d.tgt || null) : false;
      if (!ok) this.snapBack(d.id);
      return;
    }
    if (pr.moved) return;
    if (pr.id != null) { if (this.h.onTap) this.h.onTap(pr.id); }
    else if (pr.slot) { if (this.h.onSlot) this.h.onSlot(pr.slot); }
    else if (this.h.onBg) this.h.onBg();
  }

  onCancel() {
    if (this.drag) {
      const d = this.drag;
      d.ids.forEach((id) => this.cards[id].el.classList.remove('dragging'));
      this.drag = null;
      this.glow(null);
      this.snapBack(d.id);
    }
    this.press = null;
  }
}

// Spielzustand eines Levels (ohne DOM, testbar mit node --test).
// Ein Pfeil gilt als entfernt, sobald sein Abflug beginnt – er blockiert dann niemanden mehr.

export class Game {
  /**
   * @param {object} level  Ergebnis von generateLevel()
   * @param {object} geo    Ergebnis von makeCube(level.N)
   * @param {object} [saved] { removed:[ids], hearts, mistakes }
   */
  constructor(level, geo, saved = null) {
    this.level = level;
    this.geo = geo;
    this.arrows = level.arrows;
    this.n = this.arrows.length;
    this.rays = this.arrows.map((a) => geo.ray(a.cells[a.cells.length - 1], a.dir));
    this.occ = new Int32Array(geo.count).fill(-1);
    this.removed = new Uint8Array(this.n);
    this.removedCount = 0;
    this.removedOrder = [];
    this.arrows.forEach((a, i) => { for (const c of a.cells) this.occ[c] = i; });
    this.maxHearts = level.hearts;
    this.hearts = level.hearts;
    this.mistakes = 0;
    if (saved && Array.isArray(saved.removed)) {
      for (const id of saved.removed) {
        if (Number.isInteger(id) && id >= 0 && id < this.n && !this.removed[id]) this.remove(id);
      }
      if (Number.isInteger(saved.hearts)) this.hearts = Math.max(1, Math.min(this.maxHearts, saved.hearts));
      if (Number.isInteger(saved.mistakes)) this.mistakes = Math.max(0, saved.mistakes);
    }
  }

  get remaining() { return this.n - this.removedCount; }
  get won() { return this.removedCount === this.n; }

  /**
   * Prüft, ob Pfeil id frei abfliegen kann.
   * Frei:      { free: true }
   * Blockiert: { free: false, blocker, dist }  (dist = freie Zellen bis zum Hindernis)
   */
  check(id) {
    const ray = this.rays[id];
    for (let k = 0; k < ray.length; k++) {
      const o = this.occ[ray[k]];
      if (o !== -1 && o !== id) return { free: false, blocker: o, dist: k };
    }
    return { free: true };
  }

  isFree(id) { return !this.removed[id] && this.check(id).free; }

  remove(id) {
    if (this.removed[id]) return false;
    this.removed[id] = 1;
    this.removedCount++;
    this.removedOrder.push(id);
    for (const c of this.arrows[id].cells) if (this.occ[c] === id) this.occ[c] = -1;
    return true;
  }

  /** Ein Fehler: kostet ein Herz. Gibt die verbleibenden Herzen zurück. */
  loseHeart() {
    if (this.hearts > 0) {
      this.hearts--;
      this.mistakes++;
    }
    return this.hearts;
  }

  freeIds() {
    const out = [];
    for (let i = 0; i < this.n; i++) if (!this.removed[i] && this.check(i).free) out.push(i);
    return out;
  }

  /** 3 Sterne ohne Fehler, 2 bei einem Fehler, sonst 1. */
  stars() { return this.mistakes === 0 ? 3 : this.mistakes === 1 ? 2 : 1; }

  serialize() {
    return { removed: this.removedOrder.slice(), hearts: this.hearts, mistakes: this.mistakes };
  }
}

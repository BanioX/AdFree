// Geometrie des Spielfelds (reine Logik, ohne DOM).
//
// Einheiten: Blasenradius = 1, Durchmesser = 2. Das Feld ist COLS * 2 = 22 Einheiten breit.
// Zeilen sind hexagonal gepackt: «verschobene» Zeilen sind um einen Radius nach rechts versetzt
// und haben eine Blase weniger (10 statt 11). Zeile 0 hängt an der Decke.
//
//   gerade Zeile:      x = 1, 3, 5, … 21   (11 Zellen)
//   verschobene Zeile: x = 2, 4, 6, … 20   (10 Zellen)
//   y = 1 + r * √3

export const COLS = 11;
/** Erlaubte Zeilen 0..ROWS-1. Rutscht eine Blase in Zeile ROWS, ist die Runde vorbei. */
export const ROWS = 16;
export const ROW_H = Math.sqrt(3);
export const WIDTH = COLS * 2;
/** Abstand der Mittelpunkte, ab dem eine fliegende Blase «andockt» (etwas kleiner als 2 = verzeihend). */
export const HIT = 1.7;
/** Feuerkugel: Abstand, in dem sie Blasen mitreisst. */
export const FIRE_HIT = 1.9;
export const LAUNCH_X = WIDTH / 2;
export const LAUNCH_Y = 1 + ROWS * ROW_H + 1.5;
/** Gesamthöhe des Logikfelds inkl. Abschussbereich. */
export const FIELD_H = LAUNCH_Y + 2.7;
/** Todeslinie (zwischen Zeile ROWS-1 und ROWS). */
export const DEAD_Y = 1 + (ROWS - 0.5) * ROW_H;
/** Kleinster Schusswinkel zur Waagrechten (Grad). */
export const MIN_ANGLE = 8;

export function clampAngle(a) {
  return Math.max(MIN_ANGLE, Math.min(180 - MIN_ANGLE, a));
}

/** Winkel (Grad, 0 = rechts, 90 = gerade hoch) vom Abschusspunkt zu einem Punkt. */
export function angleTo(x, y) {
  return Math.atan2(LAUNCH_Y - y, x - LAUNCH_X) * 180 / Math.PI;
}

export const cellY = (r) => 1 + r * ROW_H;

/** Hex-Distanz zweier Zellen in «Ringen» (0 = gleich, 1 = Nachbar …), über Würfelkoordinaten. */
export function hexDistance(a, b, shift = 0) {
  const toCube = (r, c) => {
    // «odd-r»-Layout: verschobene Zeilen liegen rechts.
    const rr = r + shift;
    const x = c - (rr - (rr & 1)) / 2;
    return [x, rr];
  };
  const [ax, az] = toCube(a.r, a.c);
  const [bx, bz] = toCube(b.r, b.c);
  const ay = -ax - az, by = -bx - bz;
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}

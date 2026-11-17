# Verdoppeln – Inhalte ergänzen

Alle Inhalte liegen in `/merge/data/` als einfache JavaScript-Listen. Für neue Inhalte muss kein
Programmcode angepasst werden: Menü, Album, Statistik und Etappen-Karte lesen die Listen selbst.
Nach jeder Änderung die Tests laufen lassen (siehe unten).

## Kachel-Stile (`data/skins.js`)

Ein Stil ist eine Reihe von Kacheln «von klein nach gross». Kachel Nr. 1 ist die 2, Nr. 2 die 4,
Nr. 3 die 8 … – jede Stufe verdoppelt den Wert. Der Wert steht klein unten rechts auf der Kachel.

```js
{
  id: 'garten',            // eindeutig, nur a-z 0-9 -  (wird im Spielstand gespeichert – nicht mehr ändern)
  title: 'Garten',         // kurzer Anzeigename
  icon: '🌿',              // Emoji für Auswahl und Album
  board: '#dfe6cf',        // Farbe des Bretts
  slot: '#eef3e2',         // Farbe der leeren Felder
  ink: '#55603f',          // Farbe der kleinen Wert-Zahl
  dark: false,             // optional: true bei dunklem Brett
  numbers: false,          // optional: true = Zahlen statt Bilder (wie «Zahlen»)
  tiles: [
    { emoji: '🌱', name: 'Keimling', color: '#eef6dc' },
    { emoji: '🌿', name: 'Kraut', color: '#e1f0cf' },
    // … mindestens 12 Einträge, besser 14–16
  ],
}
```

Regeln (werden von `tests/content.test.mjs` geprüft):

- mindestens **12 Stufen**; jedes Emoji nur einmal pro Stil; Namen kurz (≤ 16 Zeichen), deutsch,
  Schweizer Schreibweise («ss» statt «ß»).
- Farben als `#rrggbb`. Kachelfarben hell und freundlich, damit das Emoji gut sichtbar bleibt.
  Die Reihe sollte sich von Stufe zu Stufe sichtbar verändern (Farbton oder Helligkeit).
- Die Reihenfolge soll eine kleine Geschichte erzählen (Ei → Küken → Huhn …, Komet → Mond → Sonne …).
- Gibt es im Spiel höhere Kacheln als Einträge, wird die letzte Kachel mit ✨ wiederholt.
- Keine Marken, Figuren oder fremden Namen.

Ein neuer Stil erscheint automatisch unter «Aussehen» und im Album. Damit er auch in den Etappen
vorkommt, ein Kapitel mit `skin: '<id>'` anlegen (siehe unten).

## Spielmodi (`data/modes.js`)

```js
{ id: 'entspannt5', size: 5, title: 'Entspannt', sub: '5 × 5', target: 11, blurb: 'Mehr Platz, mehr Ruhe.' }
```

- `size` 3–6, `target` = Ziel-Stufe (11 = 2048, 12 = 4096, 8 = 256).
- `id` nie umbenennen: Rekord und Spielstand hängen daran.
- `undoRules` legt fest, wie oft man rückgängig machen kann (Start-Vorrat, Höchstzahl, alle wie viele
  Züge eins dazukommt, wie viele Züge gespeichert werden).

## Etappen (`data/levels.js`)

Die Etappen werden aus diesen Daten endlos erzeugt (`levelgen.js`). Jedes Kapitel hat 12 Etappen;
nach dem letzten Kapitel beginnt «Runde 2» mit etwas höheren Zielen.

- **`chapters`** – Name, Kachel-Stil und Symbol pro Kapitel. Ein neues Kapitel einfach hinten anfügen.
- **`shapes`** – Brett-Formen. Zeilen gleich lang, quadratisch 3×3 bis 6×6:
  `.` freies Feld, `o` Stein (blockiert, bewegt sich nie), `x` Loch (gehört nicht zum Brett).
  `maxE` = höchste Ziel-Stufe, die auf dieser Form gut machbar ist. Bei neuen Formen mit dem
  Werkzeug messen: `node merge/tests/calibrate.mjs 16 <formId>` (Stufe, bei der der Computer-Spieler
  noch ≥ 60 % schafft).
- **`chapterPlan`** – Ablauf der 12 Etappen eines Kapitels: Brettgrösse (oder feste Formen),
  Ziel-Art (`'tile'` = Kachel bilden, `'count'` = mehrmals bilden), `slack` (Abstand zu `maxE`:
  2–3 leicht, 1 mittel, 0 schwer) und `boss` für die Abschluss-Etappe.
- **`handmade`** – feste Etappen für genau eine Nummer, z.B. für die ersten Lern-Etappen mit Tipp:
  `7: { shape: 'herz5', goal: { type: 'tile', value: 256 }, tip: 'Ein Herz voller Kacheln!' }`
- **`stars`** – Sterne-Grenzen: 3 Sterne bei wenigen Zügen (nahe an der Mindestzahl), sonst 2 oder 1.

## Tests

```sh
node --test merge/tests/*.test.mjs        # Regeln, Inhalte, Lösbarkeit der Etappen
python3 -m http.server 8208 --bind 127.0.0.1 &
node merge/tests/e2e.mjs                  # ganzer Ablauf im iPhone-Browser (Screenshots in tests/out/)
```

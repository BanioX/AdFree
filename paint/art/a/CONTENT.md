# Farbenzauber – Bilder von Team A (Blumen, Tiere)

Handgezeichnete Vektorbilder für «Malen nach Zahlen». Jedes Bild ist ein Generator-Skript in
`src/`, das ein `Puzzle` (Format siehe `/DEV.md`) erzeugt und als Modul `<name>.js` speichert.
Die Liste `index.js` (`export const pictures = [{ id, title, category, load }]`) wird ebenfalls
erzeugt und von `/paint/art/index.js` mit den Bildern von Team B zusammengeführt.

## Aktuelle Bilder (einfach → reich)

| Datei | id | Titel | Kategorie |
|---|---|---|---|
| rose | a-rose | Rose | Blumen |
| tulpenfeld | a-tulpenfeld | Tulpenfeld | Blumen |
| schmetterling | a-schmetterling | Schmetterling auf Blüte | Tiere |
| seerose | a-seerose | Seerose | Blumen |
| sonnenblumen | a-sonnenblumen | Sonnenblumen in Vase | Blumen |
| igel | a-igel | Igel mit Pilzen | Tiere |
| fuchs | a-fuchs | Fuchs im Herbstlaub | Tiere |
| koi | a-koi | Koi im Teich | Tiere |
| eule | a-eule | Eule bei Mondschein | Tiere |

## Ein neues Bild hinzufügen

1. `src/<name>.mjs` anlegen (am besten ein ähnliches Bild kopieren):
   ```js
   import { Pic, circle, petalPts, tf, smooth } from './lib.mjs';
   export const meta = { id: 'a-<name>', title: 'Deutscher Titel', category: 'Blumen' };
   export function build() {
     const pic = new Pic({ ...meta, width: 1000, height: 1000 });
     pic.pal({ himmel: '#cfe6f2', blatt: '#6fa64e' /* … 8–18 Farben */ });
     pic.add('M0 0H1000V1000H0Z', 'himmel');   // erste Form = Hintergrund (ausmalbar)
     pic.add(circle(500, 500, 120), 'blatt');   // spätere Formen liegen oben
     return pic;
   }
   ```
2. `<name>` in `ORDER` in `src/build.mjs` eintragen (Reihenfolge = Schwierigkeit in der Galerie).
3. Bauen: `node paint/art/a/src/build.mjs <name>` (ohne Namen: alle Bilder). Der Bauer teilt Formen,
   deren sichtbarer Teil in mehrere Stücke zerfällt, automatisch auf und lässt verdeckte Krümel
   (< 300 px sichtbar) weg (`autoSplit` in `src/raster.mjs`).
4. Prüfen und anschauen: `node paint/art/a/tools/check.mjs <name>` – schreibt nach `tools/out/`
   das farbige Bild (`a-<name>.png`), die Malvorlage mit Nummern (`-num.png`), ein Paar und einen
   Kontaktbogen (`sheet.png`). Die PNGs **ansehen** und so lange verfeinern, bis das Bild gefällt.
5. Tests: `node --test paint/art/a/tests/*.test.mjs` (Format, Abdeckung, sichtbare Flächen,
   Datei = Generator) und `node paint/art/a/tests/e2e.mjs` (alle Bilder in der echten App).

## Hilfsmittel in `src/`

- `lib.mjs`: Punkte und Transformationen (`tf`, `rot`, `mirrorX`), glatte Kurven (`smooth`,
  Punkt mit `'c'` = Ecke), Grundformen (`circle`, `ellipse`, `rect`, `rrect`, `wedge`, `arcBand`),
  organische Formen (`petalPts`, `leafHalves` – Blatt in zwei Hälften, `blobPts`, `starPts`,
  `crescent`, `swirlPts`, `heartPts`), Landschaft (`wavePts`, `band`, `fillBelow`) und `Pic`.
- `geom.mjs`: Boolesche Operationen über Abstandsfelder (`union`, `intersect`, `subtract`,
  `offset`) – z.B. Muster auf einer Vase: `intersect(vase, streifen)`.
- `raster.mjs`: Rasterung für `autoSplit` und die Tests.

## Gestaltungsregeln

- Erwachsenes Malbuch: ganze Fläche bedeckt, Hintergrund dekorativ in Bereiche geteilt.
- 60–250 Bereiche, 8–18 harmonische Farben mit hellen/mittleren/dunklen Tönen.
- Keine Splitter: kleinste sichtbare Bereiche ≥ ca. 18×18 (bei 1000×1000), nicht dünner als ~9.
- Weiche Kurven, Nachbarbereiche möglichst in verschiedenen Farben.
- Eigene Motive, keine Marken oder Figuren. Titel auf Deutsch (Schweiz: «ss» statt «ß»).

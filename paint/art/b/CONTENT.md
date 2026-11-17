# Farbenzauber – Bilder von Team B (Landschaften, Essen, Fantasie, Winter)

Handgezeichnete Vektorbilder für «Malen nach Zahlen». Jedes Bild ist ein Generator-Skript in
`src/`, das ein `Puzzle` (Format siehe `/DEV.md`) erzeugt und als Modul `<name>.js` speichert.
`index.js` (`export const pictures = [{ id, title, category, load }]`) wird mit erzeugt.

## Aktuelle Bilder (einfach → reich)

| Datei | id | Titel | Kategorie |
|---|---|---|---|
| cupcake | b-cupcake | Cupcake mit Kirsche | Essen |
| adventskranz | b-adventskranz | Adventskranz | Winter |
| cafe | b-cafe | Kaffee und Gipfeli | Essen |
| ballone | b-ballone | Heissluftballone | Landschaften |
| leuchtturm | b-leuchtturm | Leuchtturm an der Küste | Landschaften |
| lebkuchenhaus | b-lebkuchenhaus | Lebkuchenhaus | Winter |
| unterwasser | b-unterwasser | Unterwasserwelt | Landschaften |
| bergsee | b-bergsee | Bergsee mit Chalet | Landschaften |
| schloss | b-schloss | Märchenschloss | Fantasie |
| winterdorf | b-winterdorf | Winterdorf | Winter |

## Ein neues Bild hinzufügen

1. `src/<name>.mjs` anlegen (ähnliches Bild als Vorlage nehmen):
   ```js
   import { Pic, rect, circle, band, wavePts } from './lib.mjs';
   export const meta = {
     id: 'b-<name>', title: 'Deutscher Titel', category: 'Landschaften',
     palette: { himmel: '#a9cfee', wiese: '#a4cd63' /* … 8–18 Farben */ },
   };
   export default function build() {
     const p = new Pic(meta);
     p.tag('himmel');                                   // Gruppenname für die Prüf-Ausgabe
     p.add(rect(-10, -10, 1020, 1020), 'himmel');       // erste Form = Hintergrund
     p.add(band(wavePts(-10, 1010, 700, 12, 400), 1010), 'wiese');
     p.add(circle(800, 200, 60), 'wiese', { prune: true }); // darf wegfallen, wenn fast verdeckt
     return p;
   }
   ```
2. `<name>` in `ORDER` in `src/build.mjs` eintragen (Reihenfolge = Schwierigkeit).
3. Bauen: `node paint/art/b/src/build.mjs <name>`. Der Bauer misst in Chromium die sichtbaren
   Flächen, entfernt fast verdeckte Füllformen (`prune`), teilt zerfallene Formen und hängt
   Reststücke an Nachbarn an.
4. Prüfen und anschauen: `node paint/art/b/tools/check.mjs <name>` – schreibt `tools/out/<id>-farbig.png`,
   `-vorlage.png` (Malvorlage mit Nummern), `-debug.png` und `kontaktbogen.png`. Die PNGs **ansehen**
   und verfeinern, bis das Bild gefällt.
5. Tests: `node --test paint/art/b/tests/*.test.mjs` und `node paint/art/a/tests/e2e.mjs`
   (prüft alle Bilder beider Teams in der echten App).

## Hilfsmittel in `src/lib.mjs`

`Path` (verschieben, drehen, spiegeln), `rect`/`roundPoly`, `ellipse`/`circle`/`ring`, `smooth`
(Punkt `[x, y, 1]` = Ecke), `wedge`, `annulusSeg`, `archBand` (Regenbogen), `star`, `petal`, `leaf`,
`bumpy`/`cloud` (Wolken, Rüschen, Blüten), `wavePts`/`band`/`between` (Landschaftsstreifen),
`heart`, `drop`, `capsule`, `stroke` (dicker Strich als Fläche), `foldedStar`, `sprig`, `clipRect`.

## Gestaltungsregeln

- Erwachsenes Malbuch: ganze Fläche bedeckt, Hintergrund dekorativ in Bereiche geteilt.
- 60–250 Bereiche, 8–18 harmonische Farben mit hellen/mittleren/dunklen Tönen.
- Keine Splitter: kleinste sichtbare Bereiche ≥ ca. 18×18 (bei 1000×1000).
- Eigene Motive, keine Marken oder Figuren. Titel auf Deutsch (Schweiz: «ss» statt «ß»).

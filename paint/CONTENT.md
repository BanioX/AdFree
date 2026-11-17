# Farbenzauber – Inhalte erweitern

Farbenzauber (Malen nach Zahlen) holt seine Bilder aus vier Quellen:

| Quelle | Ort | Wer pflegt |
| --- | --- | --- |
| Handgezeichnete Bilder | `art/a/`, `art/b/` (je mit `index.js`) | Künstler-Teams |
| Generatoren (Mandala, Buntglas, Low Poly) | `gen/` | Engine |
| Ausgewählte Generator-Bilder, Kategorien, Foto-Vorgaben | `data/catalog.js` | alle |
| «So geht's» und Tipps | `data/howto.js` | alle |
| Eigene Fotos | IndexedDB auf dem Gerät | Spielerin |

Die Galerie baut sich daraus selbst auf. Nach jeder Änderung prüfen (siehe «Prüfen» unten).

## 1. Ein handgezeichnetes Bild hinzufügen

1. Datei anlegen, z.B. `art/a/eule.js`, mit `export default { …Puzzle }` – Format siehe `DEV.md`
   («Datenformat: Farbenzauber»): `width`, `height`, `palette` (max. 30 Farben, `#rrggbb`),
   `shapes` (SVG-Pfade `d` + Farbindex `c`, optional `r: 'evenodd'`), optional `lines`, `background`.
2. In `art/a/index.js` (bzw. `art/b/index.js`) eintragen:
   ```js
   { id: 'a-eule', title: 'Eule im Mondschein', category: 'Tiere', load: () => import('./eule.js').then((m) => m.default) },
   ```
   - `id`: nur `a-z`, `0-9`, `-`; mit Team-Präfix (`a-…`, `b-…`), eindeutig.
     Reserviert für die Engine: `g-…` (Generatoren), `foto-…` (eigene Fotos), `fx-…` (Testbilder).
   - `category`: bestehende Kategorie verwenden (Blumen, Tiere, Landschaften, Essen, Fantasie, Winter …)
     oder eine neue – sie erscheint automatisch als eigener Chip. Reihenfolge: `data/catalog.js`.
3. `art/index.js` muss **nicht** angepasst werden: es lädt beide Team-Listen und überspringt
   fehlerhafte Einträge. Bilder, die (noch) nicht laden, werden in der Galerie ausgeblendet.

**Tipps für schöne Malbilder**

- Erste Form = ganzer Hintergrund; danach von hinten nach vorne zeichnen (Maler-Reihenfolge).
  Eine Form ist genau ein antippbares Feld – ihr sichtbarer Teil ist, was nicht überdeckt wird.
- Formen dürfen über den Bildrand hinausragen (werden abgeschnitten), aber es darf keine Lücke geben.
- Felder nicht zu klein: unter ca. 3.5 Einheiten Breite (bei 1000×1000) werden sie automatisch
  vorausgefüllt. 60–250 Felder und 10–20 Farben fühlen sich auf dem iPhone am besten an.
- Nummern und ihre Grösse berechnet die Engine selbst (Punkt mit grösstem Randabstand).
- Gleiche Farbe nebeneinander nicht in viele Einzelformen zerlegen – lieber eine grössere Form.
- Titel deutsch, Schweizer Rechtschreibung (ss statt ß). Nur eigene Motive, keine Marken/Figuren.

## 2. Generator-Bilder auswählen

`data/catalog.js` → `GENERATOR_SEEDS`: pro Generator die Seeds, die immer in der Galerie stehen.
Gleicher Seed = gleiches Bild auf jedem Gerät. Ein schönes Bild gefunden (z.B. über «Neues erzeugen»
oder die Vorschau unten)? Seed (1–999) in die Liste eintragen. Seeds ab 1000 sind für
«Neues erzeugen» reserviert. Vorschau vieler Seeds:

```sh
node paint/gen/tests/check.mjs --gen glas --seeds 1-24      # Bilder in paint/gen/tests/out/
```

## 3. Einen neuen Generator bauen

1. Reines Modul ohne DOM in `gen/core/<name>.js` mit `export function makeX(seed) { return Puzzle; }`
   – deterministisch (nur `makeRng` aus `shared/rng.js`), lückenlos, 120–400 Flächen, 8–16 Farben.
   Hilfen: `gen/core/util.js` (`finalizePuzzle`, Rauschen), `delaunay.js`, `color.js`, `palettes.js`.
2. In `gen/index.js` in `generators` eintragen: `{ id, title, category, make }`.
3. Kategorie in `data/catalog.js` → `CATEGORY_ORDER`, Seeds in `GENERATOR_SEEDS`.
4. Die Galerie zeigt automatisch einen Abschnitt mit «Neues erzeugen».

## 4. «So geht's» und Tipps

`data/howto.js`:
- `HOWTO`: 3–4 Schritte (`demo`: `'tap' | 'goal' | 'brush' | 'hint'`, Titel 2–4 Wörter, ein Satz).
  Die animierten Mini-Szenen stehen in `tutorial.js` (Objekt `DEMOS`) – neue Szene dort ergänzen.
- `TIPS`: einmalige Hinweise während des Malens nach `after` ausgemalten Feldern.

## 5. Eigene Fotos

Vorgaben (Farben 8–24, Detail Grob/Mittel/Fein) in `data/catalog.js` → `PHOTO_DEFAULTS`.
Die Umwandlung (`gen/photo.js` → Worker `gen/photo-worker.js` → `gen/core/photo.js`) läuft auf dem
Gerät; das Ergebnis wird in IndexedDB gespeichert und bleibt privat.

## Prüfen

```sh
node --test paint/tests/*.test.mjs              # Logik, Generatoren, alle Bibliotheksbilder, Daten, Foto
node paint/tests/art.mjs              # jedes Bild im Browser analysieren + Kontaktabzug
node paint/tests/e2e.mjs              # ganze App auf dem «iPhone 13» (Port 8101)
```

Kontaktabzug und Screenshots landen in `paint/tests/out/` (nicht eingecheckt).

## Spielstand (zur Information)

localStorage (`spielpause.`-Präfix): `paint.prog.<id>` (Fortschritt pro Bild), `paint.stats`,
`paint.gen.<generator>` (erzeugte Seeds), `paint.photos` (Liste eigener Fotos), `paint.chip`,
`paint.photoOpts`, `tutorial.paint`. IndexedDB (`kv`): `paint.photo.<id>`, `paint.thumb.<id>`,
Analyse-Cache. Ändert sich ein Bild, erkennt die Engine das am Inhalts-Hash und passt den
Fortschritt an.

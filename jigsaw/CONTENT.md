# Puzzle – Inhalte ergänzen

Alle Bilder von «Puzzle» werden **im Gerät gemalt** (keine Bilddateien). Ein Bild besteht aus
**Maler + Palette + Seed** – gleicher Seed ergibt immer genau dasselbe Bild. Dazu kommen Bilder aus
«Farbenzauber» und eigene Fotos.

| Was | Datei |
| --- | --- |
| Bildersammlungen (Packs) | `data/packs.js` |
| Farbpaletten | `data/palettes.js` |
| Maler (prozedurale Bilder) | `art/<maler>.js`, Verzeichnis `art/index.js`, Werkzeugkasten `art/kit.js` |
| Zufallsbilder (Maler × Paletten, Namen) | `data/packs.js` → `randomRecipes`, `randomNames` |

## Ein neues Bild in einem Pack

In `data/packs.js` beim passenden Pack eine Zeile ergänzen:

```js
{ id: 'seeblick', title: 'Stiller Seeblick', palette: 'minze', seed: 113, opts: { lake: true } },
```

- `id`: klein, `a-z0-9-`, eindeutig im Pack. Der Schlüssel des Bildes ist `<pack>/<id>` – **nie umbenennen**,
  sonst gehen Spielstände und «gelöst»-Abzeichen verloren.
- `title`: deutscher Anzeigename (Schweizer Rechtschreibung: «ss», kein «ß»).
- `palette`: Name aus `data/palettes.js`.
- `seed`: beliebige positive Ganzzahl. Andere Zahl = anderes Bild. Einfach ausprobieren.
- `opts` (optional): Wünsche an den Maler (siehe unten).
- `painter` (optional): anderer Maler als der des Packs.

## Ein neues Pack

```js
{
  id: 'herbst', title: 'Herbstzauber', painter: 'wald', emoji: '🍂',
  images: [ { id: 'goldwald', title: 'Goldener Wald', palette: 'herbst', seed: 1001 }, … ],
},
```

Die Reihenfolge in `packs` ist die Reihenfolge im Menü. Mindestens 6 Bilder pro Pack.

## Maler und ihre Wünsche (`opts`)

| Maler | Motiv | `opts` |
| --- | --- | --- |
| `berge` | Gipfel, Wolken, Dunst, See oder Wiese | `lake`, `winter`, `snow` (0–1), `snowfall`, `clouds` (Anzahl), `layers`, `tall`, `sunX` (0–1) |
| `wiese` | Blumenwiesen und Felder | `kind`: `'wild'`, `'mohn'`, `'lavendel'`, `'tulpen'`, `'sonnen'`; `tree` |
| `meer` | Küste, Sonnenuntergang | `horizon` (0–1), `sunX`, `boat`, `islands`, `foreground` |
| `nacht` | Sternenhimmel | `milkyway`, `aurora`, `crescent`, `meteor`, `cabin` |
| `muster` | Abstrakte Farbspiele | `style`: `'wellen'`, `'kreise'`, `'mosaik'`, `'boegen'`, `'aquarell'`, `'terrazzo'` |
| `ballone` | Heissluftballone über Feldern | – |
| `unterwasser` | Riff, Fische, Lichtstrahlen | – |
| `bluete` | Blütenzweige | – |
| `wald` | Wälder im Nebel | – |

Fehlende Wünsche wählt der Maler selbst (aus dem Seed).

## Eine neue Palette

In `data/palettes.js` ergänzen. Jede Palette hat **dieselben Rollen**, damit sie mit jedem Maler funktioniert:

```js
pfirsich: {
  title: 'Pfirsich',
  sky: ['#…', '#…', '#…'],   // Himmel oben → unten (2–4 Farben)
  sun: '#…',                 // Sonne/Mond/Licht
  far: '#…', near: '#…',     // fernste und nächste (dunkelste) Ebene
  haze: '#…', ground: '#…',  // optional: Dunst, Boden
  accents: ['#…', '#…', '#…'], // 3–8 Akzentfarben (Blumen, Ballone, Fische …)
},
```

Farben immer als `#rrggbb`. Damit Zufallsbilder sie verwenden, die Palette bei passenden Malern in
`randomRecipes` eintragen.

## Einen neuen Maler

1. Datei `art/<id>.js` mit `export default { id, title, paint(ctx, P) { … } }`.
   `P = { w: 1000, h: 1333, rng, pal, opts, makeCanvas }` – gemalt wird im Koordinatenraum 1000 × 1333 (3:4).
   Nur `rng` für Zufall verwenden (nie `Math.random`), sonst ist das Bild nicht reproduzierbar.
   Hilfen aus `art/kit.js` (Himmel, Hügel, Wolken, Bäume, Pinselstriche, Körnung, Vignette …).
2. In `art/index.js` importieren und in `painters` eintragen.
3. In `randomRecipes` (und `randomNames`) eintragen.

Gut puzzlebare Bilder haben **überall etwas Struktur** (keine grossen einfarbigen Flächen) und klare
Farbzonen. Vorschau aller Bilder: Server starten und `/jigsaw/tests/sheet.html` öffnen
(`?pack=berge`, `?w=200`, `?n=6`).

## Bilder aus «Farbenzauber»

Werden automatisch übernommen (`/paint/art/index.js` und `/paint/gen/index.js`, dynamisch geladen –
fehlen sie, erscheinen einfach keine solchen Packs). Fertig ausgemalte Bilder werden pro Kategorie zu
einem Pack, jeder Generator liefert ein Pack mit 8 Bildern. Hier ist nichts zu tun.

## Eigene Fotos

Über «Eigenes Foto» gewählt, mittig auf 3:4 zugeschnitten, verkleinert (max. 1200 px) und in IndexedDB
gespeichert. Löschen über «Meine Fotos» → «Bearbeiten».

## Teilezahlen

Stufen 12 / 24 / 48 / 70 / 108 (`TIERS` in `logic.js`). Im 3:4-Format passen sie genau
(3×4, 4×6, 6×8, 7×10, 9×12); quadratische Bilder aus «Farbenzauber» bekommen die nächstliegende Zahl.

## Prüfen

```sh
node --test jigsaw/tests/                       # Logik, Lösbarkeit, Inhalte (malt jedes Bild mit einer Attrappe)
python3 -m http.server 8223 --bind 127.0.0.1   # aus dem Repo-Wurzelverzeichnis
node jigsaw/tests/e2e.mjs                       # Ablauf im iPhone-Browser (Screenshots in tests/out/)
```

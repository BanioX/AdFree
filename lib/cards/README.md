# /lib/cards – Karten-Bibliothek der Patience-Familie

Gemeinsamer Code für Pyramide (`/pyramid/`), Gipfel (`/tripeaks/`), Golf-Patience (`/golf/`) und die
Spalten-Patiencen Yukon (`/yukon/`), Skorpion (`/scorpion/`) und Bäckerdutzend (`/bakers/`).
Gelernt und angepasst aus `/solitaire/` (dort wird nichts geändert). Vanilla ES-Module, kein Build.

| Datei | Inhalt |
|---|---|
| `deck.js` | **reine Logik** (auch in Node): Kartencode 0..51, `suitOf`, `rankOf`, `rankLabel`, `cardName`, `shuffledDeck(seed)` (deterministisch über `shared/rng.js`), `adjacent(a, b, wrap)`, `popcount` |
| `face.js` | Vorderseiten: SVG-Sprite der vier Farben (`installSprite`), `faceHTML(code)` mit grossem Eckwert und eigenen Bildkarten-Motiven |
| `backs.js` | Kartenrücken (`BACKS`, SVG-Muster als Data-URL) – neuer Rücken = neuer Eintrag |
| `tables.js` | Tisch-Hintergründe (`TABLES`: Filz, Leinen, Holz) |
| `table.js` | `CardTable`: Karten als DOM-Elemente mit eigener Tween-Schleife (schläft wenn ruhig), Antippen, Ziehen & Ablegen mit Ziel-Leuchten, Auswahl, Tipp-Leuchten, Wackeln, Coach-Ring, Flugbahnen mit Bogen (`move({ arc, lift, stagger })`) und Gewinn-Fächer (`fan`) |
| `shell.js` | Rahmen: Tisch-Design (gemeinsam gespeichert unter `cards.design`), Spiel-Topbar, Werkzeugleiste, Talon-Plakette, «+30»-Text, Einstellungs-, Statistik- und Gewinnblatt, `Clock`, Mini-Karten für Tutorials |
| `cards.css` | Aussehen von Karten, Tisch, Leisten und Blättern (Spiele setzen nur `--accent`) |
| `stack.js` | `StackTable` (erweitert `CardTable`): ganze Kartengruppen ziehen; das Spiel liefert `dragGroup(id)`, `dropTarget(ids, p)`, `onDrop(ids, tgt)` |
| `search.js` | **reine Logik**: `dfs` (Tiefensuche, beweist auch Unlösbarkeit) und `bestFirst` (gierige Bestensuche) mit Transpositionstabelle, `colsKey` für kanonische Schlüssel |
| `patience.js` | `runPatience(cfg)`: kompletter Rahmen für Spalten-Patiencen – Startbildschirm (`gameMenu`), Tutorial, Coach-Mark, Austeilen, Tippen/Ziehen, Tipp, Rückgängig, «Automatisch beenden», Hinweis «geht nicht mehr auf», Fortschrittsring, Lob, Speichern/Fortsetzen (`#play`, `#daily`), Statistik, Gewinnblatt. Regeln kommen aus `/<spiel>/logic/` |
| `patience.css` | Aussehen der Spalten-Patiencen (Fortschrittsring, Lob, Knopf «Automatisch beenden» …) |
| `tutkit.js` | Bausteine für Tutorial-Szenen: `pile`, `moveGroup`, `flip`, `home`, `tslot`, `tool`, `label`, `peek` |
| `tests/e2e-kit.mjs` | gemeinsamer Playwright-Ablauf für Spalten-Patiencen (`runE2E({ id, port, … })`) |

## Kurzbeispiel

```js
import { CardTable } from '../lib/cards/table.js';
import { applyCardTheme, gameTop, toolbar, badge } from '../lib/cards/shell.js';
import { shuffledDeck } from '../lib/cards/deck.js';

applyCardTheme(app);
const t = new CardTable(boardEl, { onTap: (id) => …, canDrag: (id) => …, onDrop: (id, target) => … });
t.setSize(cw, ch);                 // Kartengrösse aus dem eigenen Layout
t.build(shuffledDeck('meinspiel|1'));
t.set(T);                          // T[id] = { x, y, z, up, b?, hide? } – sofort
await t.move(T, { stagger: 28, arc: 16 });   // animiert
```

Das Spiel berechnet Positionen selbst; `CardTable` kennt keine Regeln. Regeln, Löser und
Generatoren gehören in `/<spiel>/logic/` (rein, mit `node --test` getestet).

Lesbarkeit: Eckwerte sind gross und fett (auch bei 40 px breiten Karten auf dem iPhone gut
lesbar); bedeckte, nicht spielbare Karten werden leicht abgedunkelt.

## Spalten-Patiencen (`patience.js`)

```js
import { runPatience } from '../lib/cards/patience.js';
runPatience({
  id: 'yukon', title: 'Yukon', tagline: '…', accent: '#3a6fb0', confetti: [...],
  modes: [{ id: 'klassisch', label: 'Klassisch', sub: '…' }], dailyMode: 'klassisch',
  rows: [[0, 1, 2, 3, 4, 5, 6]], foundSlots: [3, 4, 5, 6], stockSlot: null,
  foundHTML: (i) => suitSVG(i), emptyHTML: (c, st) => 'K', tutorial: steps, coachText: '…',
  game: { newGame, fromSeed, isLegal, step, settle, legalMoves, isWon, foundationPiles,
          downOf, canPick, stock?, hint, finish?, progress, solve },
});
```

Züge sind `{ t: 'f', from }` (Ablage), `{ t: 'm', from, idx, to }` (Gruppe ab `idx`) und
`{ t: 'd' }` (Reserve austeilen). Karten-IDs auf dem Tisch sind die Kartencodes 0..51.
Jede neue Austeilung wird im Spiel selbst mit dem Löser geprüft (Seed-Suche, deterministisch).

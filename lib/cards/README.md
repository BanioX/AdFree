# /lib/cards – Karten-Bibliothek der Patience-Familie

Gemeinsamer Code für Pyramide (`/pyramid/`), Gipfel (`/tripeaks/`) und Golf-Patience (`/golf/`).
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

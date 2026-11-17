# Stapel-Sortieren (`/lib/sorting/`)

Gemeinsamer Code für **Kugelsortierung** (`/ballsort/`), **Schrauben & Muttern** (`/screws/`) und
**Wollknäuel** (`/yarn/`). Ein neues Sortier-Spiel braucht nur Aussehen, Inhalte und ein Tutorial.

| Datei | Inhalt |
|-------|--------|
| `engine.js` | Reine Regeln: Zustand `{ cap, stacks }`, `moveCount`, `applyMove`/`undoMove`, `legalMoves`, `isSolved`, `validateState`. Regel-Varianten `{ move: 'single' \| 'group', complete: 'lock' \| 'clear' }` |
| `solver.js` | Gewichtete A*-Suche über Makro-Züge (deterministisch, Knotenlimit), `solve`, `hint`, `expandMoves` |
| `generator.js` | `generateLevel({ seed, colors, cap, empties, fill, rules, minMoves, maxMoves, maxTries })` – mischt, prüft mit dem Löser, liefert `stacks`, `par`, `solution` |
| `board.js` | DOM-Spielfeld: Layout (1–3 Reihen, passt in 375–430 px), Tween-Maschine (Anheben, Bogenflug, Federn), Auswahl, Tipp-Leuchten, Coach-Ring, Funken, verdeckte Teile, `miniBoard` für Vorschauen |
| `shell.js` | `runSortGame(cfg)`: Startbildschirm (`gameMenu`), Modi Kapitel/Entspannt/Knifflig, Tagesrätsel, Spielansicht mit Rückgängig/Tipp/Extra-Stapel/Neustart, Speichern + Hash-Routing, Sterne, Statistik, Gewinnblatt |
| `tutorial.js` | `sortTutorial(…)` – 3–4 Tutorial-Schritte mit echtem Mini-Spielfeld und Finger |
| `audio.js` | `tone()`, `noise()` – eigene kurze Klänge über `sfx.output().node` |
| `sorting.css` | Styles für Spielfeld, Spielansicht, Kapitel-Karten, Levelraster, Tutorial-Demo |
| `tests/` | `node --test lib/sorting/tests/*.test.mjs` und gemeinsamer Playwright-Ablauf `e2e-common.mjs` |

## Ein Spiel anschliessen

```js
import { runSortGame } from '../lib/sorting/shell.js';
runSortGame({
  id: 'ballsort', title: 'Kugelsortierung', tagline: '…', accent: '#e0643c',
  rules: { move: 'single', complete: 'lock' },
  names: { stack: 'Röhre', stacks: 'Röhren', piece: 'Kugel', pieces: 'Kugeln', extra: '+1 Röhre', extraLong: '…' },
  view: { aspect, step, padTop, padBottom, side, liftGap | liftTop, maxPiece, gapX, gapY,
          makeStack(i), makeFront?(i), makePiece(color, { hidden }), travel?(el, on),
          complete?(stackEl, color, board, i, fx), clear?(els, color, i, board) → Promise },
  chapters, chapterSize, level(n), zen(k), hard(k), daily(dayKey), dailyLabel,
  tutorial: () => sortTutorial({...}), sounds: { lift, land, complete, error, hint, win },
  showcase: { cap, stacks },            // Menü-Bild, solange kein Spiel läuft
  confetti(run), sections?(), decorate?(root, run), hud?(state, run), onWin?(run), winExtra?(run),
});
```

Level-Parameter (`level(n)` usw.): `{ colors, cap, empties, fill?, hidden?, minMoves?, maxMoves?, maxTries?, tag? }`.
`hidden: true` verdeckt alle Teile unter dem obersten, bis sie oben liegen.

Speicher-Schlüssel (Präfix `spielpause.`): `<id>.progress`, `<id>.stats`, `<id>.settings`, `<id>.run.<slot>`
(`main`, `replay`, `zen`, `hard`, `daily`), `<id>.coached`. Test-Haken: `window.__sg` (Zustand, Lösung, Mittelpunkte).

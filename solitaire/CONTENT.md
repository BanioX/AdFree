# Solitär – Inhalte erweitern

Solitär enthält drei Spielarten (Klondike «Ziehe 1/3», Spider «1/2/4 Farben», FreeCell),
Tagesrätsel, Kartenrücken und Tische. Alle Inhalte liegen in `/solitaire/data/` und lassen sich
ohne Änderungen am Spielcode erweitern.

## Übersicht

| Datei | Inhalt |
|---|---|
| `data/backs.js` | Kartenrücken (Farben + Muster als SVG) |
| `data/tables.js` | Tisch-Hintergründe (Filz, Leinen, Holz) |
| `data/seeds.js` | Beweisbar lösbare Partie-Nummern und Tagesrätsel (automatisch erzeugt) |
| `howto.js` | «So geht's»-Schritte mit animierten Mini-Demos |
| `cardface.js` | Kartengesichter (Bildkarten sind kleine SVG-Figuren) |
| `logic/` | Regeln, Löser, Tipps, Statistik (reine Logik, mit `node --test` getestet) |

## Neuer Kartenrücken

In `data/backs.js` einen Eintrag in `BACKS` ergänzen:

```js
{ id: 'wald', name: 'Wald', bg: '#2f5d3a', fg: '#b9e3a8', frame: '#f8fbf4', pattern: 'leaves', medallion: true },
```

- `id`: eindeutig, nur `a-z0-9-`. `name`: höchstens 11 Zeichen (passt unter das Vorschaubild).
- `bg` Grundfarbe, `fg` Musterfarbe, `frame` schmaler Rand (meist fast weiss) – alle als `#rrggbb`.
- `pattern`: einer der Namen aus `PATTERNS` (`lattice`, `waves`, `leaves`, `scallops`, `stars`, `dots`,
  `sunburst`, `blossoms`, `triangles`, `tartan`, `chevron`, `clover`).
- Eigenes Muster: in `PATTERNS` eine Funktion `(b) => tile(breite, höhe, '<svg-inhalt>')` ergänzen
  (Kachel wird wiederholt) oder `{ body: '<svg-inhalt>' }` für ein Motiv über die ganze Karte (Raum 100 × 140).
  Alternativ kann ein Rücken mit `svg: '<svg …>…</svg>'` ein komplett eigenes Bild mitbringen.
- `medallion: true` legt ein ovales Schmuckmedaillon in die Mitte.

## Neuer Tisch

In `data/tables.js` einen Eintrag in `TABLES` ergänzen:

```js
{ id: 'ozean', name: 'Ozean', base: '#2a6f97', light: '#4a90b8', dark: '#1a4a66', texture: 'felt', ink: 'light' },
```

- `base` Grundfarbe, `light` Lichtfleck oben, `dark` Rand (Vignette).
- `texture`: `felt` (Filz), `linen` (Leinen), `wood` (Holz) oder `none`.
- `ink`: `light` bei dunklen Tischen (helle Schrift/Umrisse), `dark` bei hellen Tischen.

## Lösbare Partien und Tagesrätsel

Mit der Einstellung «Lösbare Partien» (Standard) teilt das Spiel nur Partien aus, die ein Löser
tatsächlich gewonnen hat. Jede Nummer in `data/seeds.js` wurde gelöst **und** die Lösung Zug für Zug
mit der Regel-Engine nachgespielt. Ist eine Liste aufgebraucht, prüft das Spiel weitere Nummern
selbst im Hintergrund (Web Worker `solver-worker.js`).

Listen erzeugen oder verlängern (dauert je nach Spielart Sekunden bis Minuten):

```sh
# 2000 lösbare Klondike-Partien (Ziehe 1) ab Nummer 1
node solitaire/tools/precompute-seeds.mjs klondike1 2000 --from 1
# Spider mit 2 Farben, 1000 Partien
node solitaire/tools/precompute-seeds.mjs spider2 1000 --from 1
# Tagesrätsel: eigener Nummernbereich, Name beginnt mit «daily-»
node solitaire/tools/precompute-seeds.mjs klondike1 1100 --from 1000001 --name daily-klondike1
# danach data/seeds.js schreiben (bestehende Listen bleiben erhalten, neue ersetzen gleichnamige)
node solitaire/tools/precompute-seeds.mjs --write
```

Modi: `klondike1`, `klondike3`, `freecell`, `spider1`, `spider2`, `spider4`
(Spider 4 Farben ist für den Löser zu schwer – diese Partien sind zufällig und als «knifflig» markiert).

Tagesrätsel: Tag *n* (seit 1. 1. 2026) spielt `DAILY[modus].seeds[n % Länge]` – für alle gleich,
jeden Tag neu. Klondike des Tages zählt für die Tagesserie der Startseite (`markDailyDone`),
Spider (1 Farbe) und FreeCell des Tages sind Zugaben. Die Listen reichen für mehr als ein Jahr ohne
Wiederholung; zum Verlängern einfach mehr Nummern erzeugen.

## «So geht's»

`howto.js` liefert die Schritte für `/shared/tutorial.js`. Jeder Schritt hat Titel, **einen** kurzen
Satz und eine animierte Demo (Karten auf grünem Filz, Finger tippt). Neue Schritte nach demselben
Muster ergänzen (höchstens 4). Die ausführlichen Regeln je Spielart stehen im Blatt «Regeln»
(`HELP` in `app.js`).

## Prüfen

```sh
node --test solitaire/tests/*.test.mjs        # Regeln, Löser, Inhalte (Rücken, Tische, Partie-Listen)
python3 -m http.server 8201 --bind 127.0.0.1  # im Repo-Wurzelverzeichnis
node solitaire/tests/e2e.mjs                  # spielt im iPhone-Browser eine Partie bis zum Sieg
```

Die Inhaltstests prüfen u.a. eindeutige ids, gültige Farben, Namenslänge, saubere SVGs und spielen
Stichproben jeder Partie-Liste mit dem Löser nach.

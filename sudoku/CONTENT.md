# Sudoku – Inhalte erweitern

Alle Inhalte liegen in `sudoku/data/`. Es sind einfache JavaScript-Module (ES-Module, JSON-ähnlich),
die ohne Build-Schritt direkt im Browser laufen. Nach jeder Änderung die Tests laufen lassen:

```sh
node --test sudoku/tests/*.test.mjs          # Logik + Prüfung aller Inhalte (ca. 2 s)
python3 -m http.server 8204 --bind 127.0.0.1 # im Repo-Wurzelverzeichnis, dann:
node sudoku/tests/e2e.mjs                    # ganze Runde auf dem «iPhone 13», Screenshots in sudoku/tests/out/
```

| Datei | Inhalt |
|---|---|
| `data/pool.js` | Rätsel-Vorrat pro Stufe (sofortiger Start, auch offline) |
| `data/difficulties.js` | Schwierigkeitsstufen (Leicht, Mittel, Schwer, Experte) und Stufe des Tagesrätsels |
| `data/themes.js` | Farbthemen des Spielbretts (Einstellungen → Farbe) |
| `data/texts.js` | Erklärungen der Tipps, eine pro Lösungstechnik |

## Rätsel hinzufügen

Ein Rätsel ist ein String mit **81 Ziffern**, Reihe für Reihe von oben links nach unten rechts,
`0` steht für ein leeres Feld:

```js
// data/pool.js
export const pool = {
  leicht: [
    '000000692390026010260097308502600900910000056006005403103840067050270084847000000',
    // … eigenes Rätsel einfach anhängen
  ],
  mittel: [ … ], schwer: [ … ], experte: [ … ],
};
```

Regeln (die Tests prüfen jedes Rätsel einzeln):

- genau **eine** Lösung,
- mit menschlichen Techniken lösbar, und die schwierigste nötige Technik passt zur Stufe
  (`minTier`/`maxTier` in `difficulties.js`),
- Anzahl Vorgaben liegt zwischen `minGivens` und `maxGivens` der Stufe,
- kein Rätsel doppelt in derselben Stufe.

Die Lösung muss nicht gespeichert werden – das Spiel rechnet sie aus. Jedes Rätsel wird beim Spielen
zufällig umgeformt (Ziffern vertauscht, gespiegelt, gedreht …). Gleiche Schwierigkeit, aber es sieht
jedes Mal anders aus – aus 200 Rätseln werden so praktisch unendlich viele.

Innerhalb einer Stufe ist der Vorrat **von sanft nach knifflig** sortiert (die ersten Rätsel sind
die angenehmsten). Ist der Vorrat einer Stufe aufgebraucht, beginnt eine neue Runde in anderer
Reihenfolge, und der Hintergrund-Generator (`worker.js`) mischt frisch erzeugte Rätsel dazu.

### Ganzen Vorrat neu erzeugen

```sh
node sudoku/tools/gen-pool.mjs        # 200 Rätsel pro Stufe (dauert etwa eine Minute)
node sudoku/tools/gen-pool.mjs 300    # 300 pro Stufe
```

Das Werkzeug erzeugt deterministisch (gleicher Aufruf = gleiches Ergebnis), prüft jedes Rätsel
und schreibt `data/pool.js` neu. Von Hand ergänzte Rätsel gehen dabei verloren – also lieber
nachher anhängen.

## Schwierigkeitsstufen

```js
// data/difficulties.js
{ id: 'schwer', title: 'Schwer', blurb: 'Mit Notizen, Paaren und Zeigern',
  minTier: 2, maxTier: 2, minGivens: 22, maxGivens: 32 },
```

| Stufe (`tier`) | Techniken |
|---|---|
| 1 | letztes freies Feld, «Nur hier möglich» (versteckter Einer), «Einzige Zahl» (nackter Einer) |
| 2 | Zeiger, Block-Linie, nackte und versteckte Paare |
| 3 | nackte und versteckte Drillinge, X-Wing |
| 4 | XY-Wing, XYZ-Wing, Schwertfisch, Vierlinge |

Neue Stufe: Eintrag in `difficulties` ergänzen, in `data/pool.js` ein gleichnamiges Array anlegen
(oder `gen-pool.mjs` laufen lassen). Menü, Statistik und Generator übernehmen die Stufe automatisch.
Das Tagesrätsel nimmt immer die Stufe `DAILY_DIFFICULTY` (zurzeit «Mittel») und ist für alle gleich:
Seed aus dem Datum.

## Farbthemen

```js
// data/themes.js
{ id: 'meer', title: 'Meer', accent: '#2f97a8', ink: '#1f8495', sel: '#c2e6ec', same: '#daf0f3',
  peer: '#edf7f9', line: '#dfebee', thick: '#9ec6cd', wave: '#8fd6e2' },
```

`accent` = Knöpfe, `ink` = eigene Zahlen, `sel` = gewähltes Feld, `same` = gleiche Zahlen,
`peer` = Reihe/Spalte/Block, `line`/`thick` = feine und dicke Linien, `wave` = Welle bei fertiger
Reihe/Spalte/Block. Helle, ruhige Töne wählen; die Zahlen müssen gut lesbar bleiben.
Im Einstellungsfenster und im Startbildschirm («Farben sammeln») stehen sechs Farbpunkte pro Reihe;
der Name muss unter den Punkt passen (höchstens 8 Zeichen, ein Test prüft das).

Optionale Felder:

- `unlock: 20` – die Farbe wird erst mit so vielen **Sternen** freigeschaltet (Reihenfolge aufsteigend).
  Sterne: jedes gelöste Rätsel bringt 1–3 ★ (3 = ohne Fehler und ohne Tipp), jedes fünfte Rätsel
  einer Stufe ist ein **Goldrätsel** und zählt doppelt. Die Summe steht in `sudoku.stars`.
- `cell: '#fffaf0'` – Papierfarbe der Felder (Standard weiss), `given: '#4a3418'` – Farbe der Vorgaben.

## Erstes Rätsel

Das allererste Rätsel (Leicht Nr. 1, noch nichts gelöst) wird mit `gentler()` aus `puzzles.js`
etwas sanfter gemacht: zusätzliche Zahlen aus der Lösung, bis nur noch 28 Felder frei sind –
bevorzugt in fast vollen Reihen/Spalten/Blöcken, damit schnell die ersten «Reihe fertig!» kommen.

## Tipp-Texte

`data/texts.js` enthält pro Technik eine kleine Funktion, die den Lösungsschritt in Worte fasst:

```js
hiddenSingle: (s) => ({
  title: 'Nur hier möglich',
  text: `${InUnit(s.units[0])} passt die ${s.place.d} nur hier. …`,
}),
```

Ein Schritt `s` enthält `tech`, `place` (`{ c: Feld 0–80, d: Ziffer }` beim Eintragen),
`elims` (zu streichende Notizen `[{ c, d }]`), `digits`, `units` (0–8 Reihen, 9–17 Spalten,
18–26 Blöcke) und `cells` (Muster-Felder, werden auf dem Brett markiert).
Kurze, freundliche Sätze; Schweizer Rechtschreibung («ss», keine «ß», Anführungszeichen «so»).
Die Tests prüfen, dass jede Technik einen Text hat und keine Lücken («undefined») entstehen.

Eine **neue Technik** braucht zusätzlich Code in `logic/human.js` (Finder-Funktion, Eintrag in
`TECHNIQUES` mit Stufe und Gewicht, Eintrag in `FINDERS`) – die Tests prüfen bei jedem Schritt, dass
nie eine richtige Zahl gestrichen wird.

# Schrauben & Muttern – Inhalte ergänzen

Die Level werden aus einem Seed erzeugt und vom Löser geprüft (`/lib/sorting/generator.js`,
`/lib/sorting/solver.js`). Jedes Level ist darum lösbar, auf allen Geräten gleich und es gehen nie
Level aus. Regeln: alle obersten Muttern gleicher Farbe drehen sich zusammen hinüber (so viele Platz
haben); eine volle, einfarbige Schraube bekommt eine Hutmutter und ist fertig.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `data/levels.js` | Kapitel (Name, Emoji, Hintergrund), Schwierigkeitskurve `levelParams(n)`, Modi `zenParams`, `hardParams`, `dailyParams` |
| `data/colors.js` | Mutterfarben (Grundton `c`, Schatten `d`, Glanz `l`, deutscher Name) |
| `app.js` | Aussehen (Schraube, Mutter, Kappe), Klänge (Ratsche, «Tink»), Tutorial-Szenen |
| `style.css` | Gewinde, eloxierte Muttern, Dreh-Animation, verdeckte Muttern |

## Level-Parameter

```js
{ colors: 6, cap: 4, empties: 2, fill: 'full', hidden: false, minMoves: 10, maxMoves: 30, maxTries: 40, tag: 'Verdeckt' }
```

- `colors` – Anzahl Farben (höchstens 12 = Anzahl in `data/colors.js`)
- `cap` – Muttern pro Schraube (3 = kurze, 4 = normale, 5 = lange Schrauben)
- `empties` – leere Schrauben am Anfang
- `fill` – `'full'` oder `'loose'` (ungleich bestückt, eine Schraube mehr)
- `hidden` – `true`: alle Muttern unter der obersten zeigen nur «?», bis sie oben liegen
- `minMoves` / `maxMoves` – gewünschte Lösungslänge (Züge), `maxTries` – Anzahl geprüfter Mischungen
- `tag` – kurzer Hinweis in der Kopfzeile

Besondere Level im Kapitelmodus: jedes 10. Level «Lange Schrauben», ab Level 15 jedes …5. «Verdeckt»,
gelegentlich «Kurze Schrauben» (nur eine freie Schraube) und «Durcheinander».

## Neues Kapitel / neue Farbe

- Kapitel: in `CHAPTERS` einen Eintrag `{ name, emoji, bg: [hell, dunkler] }` anhängen.
- Farbe: in `data/colors.js` anhängen (gut unterscheidbar, nicht grau – Grau ist für verdeckte Muttern
  reserviert) und `MAX_COLORS` in `data/levels.js` erhöhen.

## Prüfen

```bash
node --test screws/tests/*.test.mjs lib/sorting/tests/*.test.mjs
python3 -m http.server 8306 --bind 127.0.0.1 &      # aus dem Repo-Wurzelverzeichnis
node screws/tests/e2e.mjs
```

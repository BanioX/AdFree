# Kugelsortierung – Inhalte ergänzen

Die Level werden **nicht von Hand gezeichnet**, sondern aus einem Seed erzeugt und vom Löser
geprüft (`/lib/sorting/generator.js` + `/lib/sorting/solver.js`). Jedes Level ist darum garantiert
lösbar, für alle Geräte gleich und es gehen nie die Level aus.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `data/levels.js` | Kapitel (Name, Emoji, Hintergrundfarben), Schwierigkeitskurve `levelParams(n)`, Modi `zenParams`, `hardParams`, `dailyParams` |
| `data/colors.js` | Kugelfarben (Grundton `c`, Schatten `d`, Licht `l`, deutscher Name) |
| `app.js` | Aussehen (Röhre, Kugel), Klänge, Tutorial-Szenen |
| `style.css` | Glas, Korken, Glanz der Kugeln |

## Level-Parameter

```js
{ colors: 6, cap: 4, empties: 2, fill: 'full', minMoves: 15, maxMoves: 40, maxTries: 40, tag: 'Hohe Röhren' }
```

- `colors` – Anzahl Farben (höchstens so viele, wie `data/colors.js` Farben hat: 12)
- `cap` – Kugeln pro Röhre (4 normal, 5 = «Hohe Röhren»)
- `empties` – leere Röhren am Anfang (2 = entspannt, 1 = knapp)
- `fill` – `'full'` (alle Röhren voll) oder `'loose'` (ungleich gefüllt, eine Röhre mehr)
- `minMoves` / `maxMoves` – gewünschte Länge der Lösung in Zügen (der Generator sucht passende Mischungen)
- `maxTries` – wie viele Mischungen höchstens geprüft werden (bei nur einer leeren Röhre grosszügig wählen, z.B. 120)
- `tag` – kurzer Hinweis in der Kopfzeile, z.B. «Knapp»

## Neues Kapitel

In `data/levels.js` in `CHAPTERS` einen Eintrag anhängen:

```js
{ name: 'Muschelstrand', emoji: '🐚', bg: ['#f3fbfd', '#d6eef4'] },
```

Ein Kapitel hat `CHAPTER_SIZE` (15) Level. Nach dem letzten Kapitel beginnt die Liste wieder von vorn
(«Morgenwiese II» usw.) – die Schwierigkeit steigt trotzdem weiter bis 12 Farben.

## Neue Kugelfarbe

In `data/colors.js` eine Farbe anhängen (deutlich unterscheidbar von den anderen!). Danach in
`baseColors()` das Maximum `MAX_COLORS` erhöhen.

## Prüfen

```bash
node --test ballsort/tests/*.test.mjs lib/sorting/tests/*.test.mjs   # Lösbarkeit vieler Level/Seeds
python3 -m http.server 8306 --bind 127.0.0.1 &                      # aus dem Repo-Wurzelverzeichnis
node ballsort/tests/e2e.mjs                                          # spielt Level 1 bis zum Gewinn
```

Die Tests prüfen, dass die ersten 120 Level, späte Level sowie viele Entspannt-, Knifflig- und
Tagesrätsel lösbar sind, dass kein Level mit einer fertigen Röhre beginnt und dass Level 1 kurz ist.

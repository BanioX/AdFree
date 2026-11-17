# Wortsuche – Inhalte erweitern

Alle Inhalte liegen in `wordsearch/data/`. Die Rätsel selbst werden **nicht** gespeichert, sondern
aus Thema + Stufe + Seed jedes Mal neu erzeugt (`logic.js → generatePuzzle`). Ein neues Thema
bedeutet also: eine Zeile Wörter – und es gibt sofort unendlich viele Rätsel dazu.

## Ein neues Thema hinzufügen (`data/themes.js`)

```js
{ id: 'vulkane', title: 'Vulkane', emoji: '🌋', group: 'natur',
  words: 'Lava Magma Krater Asche Ausbruch Glut Gestein Rauch Kegel Schlot …' },
```

| Feld    | Regel |
|---------|-------|
| `id`    | eindeutig, nur `a-z`, `0-9` und `-` (keine Umlaute: `baeume`, nicht `bäume`) |
| `title` | Anzeigename im Katalog und im Spiel |
| `emoji` | ein Emoji als Bild des Themas |
| `group` | eine Gruppe aus `groups` oben in der Datei (bestimmt Abschnitt und Farbe) |
| `words` | **20 bis 30** Wörter, durch Leerzeichen getrennt |

Regeln für die Wörter:

- **Schweizer Rechtschreibung:** kein «ß», immer «ss» (`Strasse`, `Fussball`, `Gruss`).
- Nur Buchstaben – Ä, Ö und Ü sind eigene Buchstaben im Raster. Keine Bindestriche, Leerzeichen, Ziffern.
- **3 bis 12 Buchstaben** (längere Wörter passen nicht ins 8×8-Raster der Stufe Leicht).
- So schreiben, wie es in der Wortliste erscheinen soll (`Rüebli`, `Gipfeli`; Verben klein: `kneten`).
  Im Raster stehen automatisch Grossbuchstaben.
- Kein Wort doppelt im selben Thema. Wörter, die in einem anderen Wort stecken (`Rose` / `Rosenbogen`),
  sind erlaubt – der Generator nimmt nie beide zusammen in ein Rätsel.
- Eigene, freundliche Wörter – keine Marken- oder Produktnamen.
- Mindestens 20 Wörter, damit auch die Stufe Schwer (bis 18 Wörter) genug Auswahl hat
  und sich die Rätsel abwechseln.

Das Thema erscheint automatisch im Katalog («Themen»), im Zufallsmix und im Tagesrätsel-Kreislauf.

## Neue Gruppe

In `groups` einen Eintrag ergänzen: `{ id: 'technik', title: 'Technik & Wissen', color: '#4a7bd0' }`.
Die Farbe färbt die Themenkacheln und das Thema-Bild im Spiel.

## Stufen anpassen (`data/modes.js`)

Jede Stufe legt Rastergrösse(n), Wortanzahl, erlaubte Richtungen, Lockvögel (Wortanfänge als
Ablenkung), Überkreuzungs-Neigung und Richtzeit für die Sterne fest. Eine weitere Stufe ist ein
weiteres Objekt – Menü, Tutorial und Statistik passen sich an. `DAILY_MODE` bestimmt die Stufe des
Tagesrätsels.

## Prüfen

```sh
node --test wordsearch/tests/*.test.mjs
```

Der Test prüft jedes Thema (Schreibweise, Länge, Anzahl, Gruppe) und erzeugt für jedes Thema in jeder
Stufe mehrere Rätsel: Jedes Wort muss **genau einmal** im Raster stehen (keine zufälligen Doppel,
auch nicht rückwärts) und in einer erlaubten Richtung liegen. Schlägt etwas fehl, steht im Text,
welches Wort oder Thema das Problem ist.

Die Oberfläche testet `node wordsearch/tests/e2e.mjs` (Server auf Port 8209 nötig, siehe `DEV.md`).

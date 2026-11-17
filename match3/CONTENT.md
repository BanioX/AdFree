# Juwelen – Inhalte ergänzen

Juwelen ist ein «Drei in einer Reihe»-Spiel mit Levelkarte (endlos viele Level) und einem
Entspannt-Modus ohne Zuglimit. Alle Inhalte liegen in `/match3/data/` und sind reine JS-Module –
kein Build-Schritt nötig. Nach jeder Änderung die Tests laufen lassen (siehe unten).

| Datei | Inhalt |
| --- | --- |
| `data/levels.js` | die ersten **20 handgemachten Level** (Level 1–20) |
| `data/shapes.js` | **Brettformen** für die automatisch erzeugten Level (ab Level 21) |
| `data/worlds.js` | **Welten** der Levelkarte (je 15 Level: Name, Emoji, Farben, Deko) |
| `data/texts.js` | **Texte**: Juwelennamen, Lob, Hinweise für neue Elemente, Sieg-/Niederlage-Titel, Meilensteine |

## Ein handgemachtes Level hinzufügen oder ändern

In `data/levels.js` steht pro Level ein Objekt. Die Position in der Liste ist die Levelnummer.
Wird die Liste länger (z.B. 30 Einträge), sind automatisch die ersten 30 Level handgemacht und
der Generator beginnt erst bei Level 31.

```js
{
  map: [            // eine Zeichenkette pro Zeile, alle gleich lang, höchstens 9×9
    '---...---',
    '-.......-',
    '..iiIii..',
    '..s...s..',
    '.........',
  ],
  colors: 5,        // Anzahl Juwelenarten (3–6): weniger Farben = leichter
  moves: 20,        // Zuglimit
  goals: [          // 1–3 Ziele
    { type: 'ice' },
    { type: 'color', color: 4, n: 25 },
  ],
  tip: 'Kurzer Hinweis beim Levelstart (optional).',
  // stars: [0, 9000, 12000],  // optional: Punkte für 2 und 3 Sterne – sonst automatisch gemessen
  // itemsMax: 2,              // optional: so viele Eicheln gleichzeitig auf dem Brett
}
```

Zeichen in `map`:

| Zeichen | Bedeutung |
| --- | --- |
| `.` | normale Zelle |
| `-` | Loch (keine Zelle; Juwelen fallen hindurch) |
| `i` / `I` | Eis mit 1 / 2 Schichten (unter einem Juwel) |
| `s` / `S` | Stein (1 Treffer) / harter Stein (2 Treffer) |
| `a` | Eichel (Startposition) |

Ziele (`goals`):

| Ziel | Bedeutung |
| --- | --- |
| `{ type: 'score', n: 8000 }` | Punkte erreichen |
| `{ type: 'color', color: 0, n: 30 }` | Juwelen einer Farbe sammeln: 0 Herz, 1 Bernstein, 2 Stern, 3 Smaragd, 4 Saphir, 5 Amethyst (Farbe muss < `colors` sein) |
| `{ type: 'ice' }` | alles Eis schmelzen (braucht `i`/`I` in der Karte) |
| `{ type: 'stone' }` | alle Steine zerbrechen (braucht `s`/`S`) |
| `{ type: 'item', n: 3 }` | n Eicheln ganz nach unten bringen (weitere Eicheln fallen von oben nach) |

Regeln, die die Tests prüfen: jede Zelle muss Teil einer möglichen Dreierreihe sein, das Brett muss
zusammenhängen, jede Zelle muss von oben (senkrecht oder schräg) nachgefüllt werden können, und
der Test-Spieler muss das Level mit Zuglimit + 5 Gratis-Zügen schaffen.

**Tipp:** Mit dem Kalibrier-Werkzeug sieht man, wie viele Züge der Test-Spieler braucht
(`need`) und wie grosszügig das Zuglimit ist (`ratio` – Werte um 2–3 fühlen sich entspannt an):

```sh
node match3/tests/calibrate.mjs 1 20 6     # Level 1–20, je 6 Durchläufe
```

## Eine Brettform hinzufügen (für Level ab 21)

In `data/shapes.js` einen Eintrag ergänzen:

```js
{ id: 'blume', from: 30, map: [   // id: eindeutig, Kleinbuchstaben; from: ab diesem Level erlaubt
  '--.....--',
  '-.......-',
  '.........',
  // … höchstens 9 Zeilen, nur '.' und '-'
] },
```

Der Generator setzt Eis, Steine und Eicheln selbst auf die Form, wählt die Ziele, misst mit dem
Test-Spieler das Zuglimit und die Sterne-Punkte und speichert das Ergebnis im Browser zwischen.
Gleiche Levelnummer = immer gleiches Level.

**Wichtig:** Wer Formen, handgemachte Level oder den Generator ändert, erhöht in `levels.js` die
Konstante `VERSION` um 1 – sonst verwenden Geräte die zwischengespeicherten alten Level.

## Eine Welt hinzufügen

In `data/worlds.js` einen Eintrag anhängen. Je 15 Level bilden eine Welt; nach der letzten Welt
beginnt die Liste von vorne (mit «II», «III» … im Namen).

```js
{ name: 'Wolkenschloss', emoji: '☁️', deco: ['☁️', '🏰', '🎈', '🌈'],
  sky: ['#eef3ff', '#d8e4ff'],      // Hintergrund-Verlauf im Spiel und auf der Karte
  cells: ['#f9fbff', '#e9effc'],    // die zwei Farben der Brettfelder (Schachbrett)
  accent: '#5a7fd6' },              // Farbe von Weg, Levelknöpfen und Zug-Anzeige
```

## Texte

`data/texts.js` enthält alle spielspezifischen Texte (Juwelennamen in Einzahl/Mehrzahl, Lob bei
Kettenreaktionen, Hinweise beim ersten Auftauchen von Eis/Steinen/Eicheln, Titel für Sieg und
Niederlage, Punkte-Meilensteine im Entspannt-Modus). Schweizer Rechtschreibung: «ss» statt «ß»,
Anführungszeichen «so».

## Prüfen

```sh
node --test match3/tests/*.test.mjs        # Spiellogik, Inhalte, ≥150 Level, Lösbarkeit
python3 -m http.server 8221 --bind 127.0.0.1 &  # im Repo-Wurzelverzeichnis
node match3/tests/e2e.mjs                  # spielt Level 1 im iPhone-13-Browser durch, Screenshots in tests/out/
```

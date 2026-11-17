# Blasenzauber – Inhalte ergänzen

Alle Inhalte liegen in `/bubbles/data/`. Die Spielregeln (`core/`) und die Darstellung
(`view.js`, `sprites.js`) müssen dafür nicht angefasst werden.

| Datei | Inhalt |
|---|---|
| `data/levels.js` | handgezeichnete Level (Level 1–20, beliebig erweiterbar) |
| `data/patterns.js` | Form-Vorlagen für automatisch erzeugte Level |
| `data/worlds.js` | Welten der Levelkarte (Name, Himmel, Farben, Tierchen) |
| `data/colors.js` | Blasenfarben mit Symbol (Hilfe bei Farbschwäche) |

Es gibt beliebig viele Level: Level 1 bis `LEVELS.length` sind handgezeichnet, alle weiteren
erzeugt `core/levels.js` deterministisch aus der Levelnummer (gleiche Nummer = gleiches Level,
für alle gleich). Die Levelkarte zeigt mindestens 12 Welten à 20 Level (240 Level).

## Wabenformat (Level und Vorlagen)

Jede Textzeile ist eine Reihe Blasen, Zellen durch Leerzeichen getrennt. Die 1., 3., 5. … Zeile
hat **11** Zellen, die Zeilen dazwischen **10** Zellen und beginnen mit einem Leerzeichen – so
sieht man die Wabenform direkt im Text. Die erste Zeile hängt an der Wolkendecke.

```
'r r o o y y g g b b v',
 ' r o o y y g g b b v',
```

Zeichen in `data/levels.js`:

| Zeichen | Bedeutung |
|---|---|
| `.` | leer |
| `r o y g b v p t` | Rot, Orange, Gelb, Grün, Blau, Violett, Rosa, Türkis |
| `R O Y G B V P T` | dieselbe Farbe mit eingeschlossenem Tierchen |
| `#` | Stein (passt zu keiner Farbe, fällt nur herunter oder per Bombe/Feuer) |

In `data/patterns.js` gibt es nur `x` (Blase) und `.` (leer) – die Farben verteilt der Generator.

## Ein handgezeichnetes Level hinzufügen

In `data/levels.js` einen Eintrag ans Ende der Liste `LEVELS` setzen:

```js
{
  name: 'Regenschirm',        // Anzeigename (Schweizer Rechtschreibung, kein «ß»)
  goal: 'pets',               // optional: 'clear' (alles abräumen, Standard) oder 'pets' (Tierchen befreien)
  pets: ['🐥', '🐤'],          // optional: eigene Tierchen-Emoji, sonst die der Welt
  shots: 24,                  // optional: Schüsse; sonst automatisch (Computer-Spieler × Spielraum)
  rows: [
    '. . v v v v v v v . .',
    ' . v v P v v P v v .',
    // …
  ],
},
```

Regeln (die Tests prüfen sie):

- Jede Blase muss über Nachbarn mit der obersten Zeile verbunden sein.
- Keine Steine in der obersten Zeile, höchstens 13 Zeilen.
- Ein Level mit `goal: 'pets'` braucht mindestens ein Tierchen (Grossbuchstabe).
- Grosse gleichfarbige Flächen, die an der Decke hängen, machen ein Level zu leicht
  (ein Treffer – und alles fällt). Lieber Farben mischen.

Wichtig: Neue handgezeichnete Level verschieben die Nummern der erzeugten Level. Das ist
erlaubt (Fortschritt und Sterne bleiben pro Nummer gespeichert), sollte aber selten passieren –
am besten gleich in 20er-Paketen (eine Welt).

## Eine Form-Vorlage hinzufügen

In `data/patterns.js` einen Eintrag `{ name, rows }` mit `x`/`.` ergänzen. Die oberste Zeile
braucht Blasen, alles muss zusammenhängen. Der Generator kürzt zu hohe Formen automatisch.

## Eine Welt hinzufügen

In `data/worlds.js` einen Eintrag an `WORLDS` anhängen:

```js
{ name: 'Mohnfeld', sky: ['#ffe0dc', '#fff0ea', '#fff9f0'], colors: [1, 2, 4, 3, 5, 6, 7], pets: ['🐞', '🐝', '🌼'] },
```

- `sky`: drei helle Pastellfarben (oben → unten).
- `colors`: ids aus `data/colors.js`; die ersten werden bevorzugt.
- `pets`: Emoji, die in «Befreien»-Leveln in den Blasen stecken.
  Befreite Tierchen landen im «Tierchen-Album» des Startbildschirms (gleiche Emoji zählen zusammen).

Nach der letzten Welt beginnt die Liste von vorne («Blumenwiese II» …), die Level selbst sind
trotzdem neu.

## Farben

`data/colors.js`: Die `id` wird im Spielstand gespeichert – **nie umnummerieren**, nur anhängen
(höchstens 8 Farben). Jede Farbe hat ein eigenes Symbol (`heart`, `star`, `sun`, `leaf`, `drop`,
`moon`, `flower`, `diamond`), das in `sprites.js` gezeichnet wird.

## Prüfen

```
node --test bubbles/tests/*.test.mjs                    # Format, Lösbarkeit aller 240 Level, Physik
python3 -m http.server 8145 --bind 127.0.0.1 &          # im Repo-Wurzelverzeichnis
node bubbles/tests/e2e.mjs                              # Ablauf im iPhone-Browser
```

Der Lösbarkeitstest lässt den Computer-Spieler (`core/solver.js`) jedes Level mit dem echten
Schussbudget spielen. Schlägt er fehl, ist das Level zu schwer oder zu gross.

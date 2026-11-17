# Zahlenschlange – Inhalte

Alle Rätsel werden aus einem **Seed** erzeugt (`logic/puzzle.js`), es gibt keine Listen zu
pflegen. Anpassen lässt sich alles in **`data/difficulties.js`**.

## Wie ein Rätsel entsteht

1. Ein zufälliger Weg läuft durch alle Felder des Gitters (Nachbarn auch schräg) –
   so entsteht die Lösung 1, 2, 3 … N.
2. Mit `holes` werden die letzten Felder des Weges zu **Löchern** (freie Stellen im Brett);
   so bekommt das Brett eine unregelmässige Form und bleibt trotzdem lösbar.
3. Danach werden Zahlen in zufälliger Reihenfolge weggenommen – aber nur, wenn das
   Rätsel **genau eine Lösung** behält (vollständiger Löser `solve`) und die Lücke zwischen
   zwei gegebenen Zahlen höchstens `maxGap` Zahlen lang wird. 1 und N bleiben immer stehen.

Seeds: `hidato-<stufe>-<nummer>` und `hidato-daily-<JJJJ-MM-TT>` (für alle gleich).

## Stufen anpassen (`data/difficulties.js`)

```js
{ id: 'schwer', title: 'Schwer', w: 7, h: 7, holes: 3, givenRate: 0.33, maxGap: 6 }
```

| Feld        | Bedeutung |
|-------------|-----------|
| `id`        | interner Name (Speicherplatz, Seed) – nach dem Veröffentlichen nicht mehr ändern |
| `title`     | Anzeige im Menü (Schweizer Rechtschreibung) |
| `w`, `h`    | Breite und Höhe (bis 8×8 passt gut aufs iPhone) |
| `holes`     | Anzahl Löcher (0 = volles Rechteck) |
| `givenRate` | Anteil der Zahlen, die am Anfang dastehen (kleiner = schwerer) |
| `maxGap`    | längste erlaubte Lücke zwischen zwei gegebenen Zahlen (kleiner = leichter) |

`DAILY` legt das Tagesrätsel fest. Der Generator gibt einem Eindeutigkeits-Test nur
begrenzt Zeit (`budget`); dauert er zu lange, bleibt die Zahl einfach stehen – das Rätsel
ist dann etwas leichter, aber immer eindeutig.

## Testen

```bash
node --test hidato/tests/*.test.mjs             # gültiger Weg, eindeutig, Lücken, Ziehen, Tipps
python3 -m http.server 8304 --bind 127.0.0.1    # im Repo-Wurzelverzeichnis
node hidato/tests/e2e.mjs                       # Ablauf auf dem iPhone 13 (Screenshots in tests/out/)
```

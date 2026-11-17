# Zahlenpaare – Inhalte

Zahlenpaare braucht keine handgemachten Felder: Jedes Feld wird aus einem **Seed**
erzeugt (`logic/generator.js`) und ist garantiert lösbar. Was du anpassen kannst, steht
in **`data/levels.js`**.

## Wie ein Feld entsteht (und warum es immer lösbar ist)

Die Zahlen werden als verschachtelte «Klammer-Paare» gelegt, z.B. `3 [8 2] 7`: Jede Klammer
ist ein passendes Paar (gleich oder Summe 10). So lässt sich das ganze Feld **allein mit
Zügen in Lesereihenfolge** abräumen – ohne «Zahlen hinzufügen». Senkrechte und diagonale
Züge sind natürlich trotzdem erlaubt. Der Tipp-Knopf folgt diesem sicheren Weg, solange
er noch besteht (`linearPlan` in `logic/rules.js`).

Seeds: `numbermatch-level-<n>`, `numbermatch-daily-<JJJJ-MM-TT>`, `numbermatch-endless-<zufall>-<runde>`.
Gleicher Seed = gleiches Feld (für alle gleich, z.B. beim Tagesrätsel).

## Level anpassen (`data/levels.js`)

```js
export const INTRO = [            // die ersten Level, von Hand abgestimmt
  { count: 18, adds: 5, goal: { type: 'clear' } },
  { count: 26, adds: 5, goal: { type: 'stars', n: 3 } },
  { count: 26, adds: 5, goal: { type: 'rows', n: 2 } },
  …
];
export function levelSpec(n) { … }   // ab hier unendlich viele Level
```

| Feld    | Bedeutung |
|---------|-----------|
| `count` | Anzahl Zahlen am Anfang (gerade Zahl, 18–46; 9 pro Reihe) |
| `adds`  | wie oft «Zahlen hinzufügen» erlaubt ist |
| `goal`  | `{ type: 'clear' }` Feld leeren · `{ type: 'stars', n }` n Sterne sammeln · `{ type: 'rows', n }` n Reihen abräumen |

- Bei `stars` legt der Generator **einen Stern mehr** aus als nötig (kleine Reserve).
- Bei `rows` muss `n` kleiner sein als die Anzahl Reihen am Anfang (`count / 9`, aufgerundet).
- `DAILY` legt das Tagesrätsel fest, `endlessSpec(runde)` die Felder im Endlos-Modus,
  `ENDLESS_MAX_ADDS` wie viele «Hinzufügen» man dort höchstens ansammeln kann
  (jede abgeräumte Reihe schenkt eins).
- `GOAL_TEXT` enthält die Texte der Ziele (Schweizer Rechtschreibung, kein «ß»).

## Testen

```bash
node --test numbermatch/tests/*.test.mjs        # Regeln, Generator, Level 1–120 gewinnbar
python3 -m http.server 8304 --bind 127.0.0.1    # im Repo-Wurzelverzeichnis
node numbermatch/tests/e2e.mjs                  # Ablauf auf dem iPhone 13 (Screenshots in tests/out/)
```

Die Logik-Tests spielen die Level 1–120 und 60 Tagesrätsel automatisch durch und prüfen,
dass jedes Ziel **ohne** «Zahlen hinzufügen» erreichbar ist. Wer `levelSpec` ändert,
lässt sie einfach wieder laufen.

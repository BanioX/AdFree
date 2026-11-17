# Farbfluss – Inhalte erweitern

Farbfluss erzeugt seine Level selbst: Aus der Levelnummer (bzw. dem Datum beim Tagesrätsel)
wird mit einem festen Zufalls-Seed ein Level gewürfelt und vom Löser geprüft. Darum gibt es
unendlich viele Level, und alle Spielerinnen bekommen bei gleicher Nummer dasselbe Level.

Alle Inhalte liegen in `/sort/data/`. Nach jeder Änderung die Tests laufen lassen:

```sh
node --test sort/tests/*.test.mjs
```

Die Tests prüfen u. a.: Farben eindeutig und gut unterscheidbar, Level 1–150 und 60 Tagesrätsel
gültig, lösbar und nicht zu einfach, Schweizer Rechtschreibung, keine externen Adressen.

## Farben – `data/colors.js`

```js
{ id: 'rot', name: 'Erdbeere', color: '#f2474f', symbol: 'circle' }
```

- `id` eindeutig (a–z), `name` deutsch, `color` als Hex, `symbol` für die Farbsymbol-Hilfe
  (Optionen → «Farbsymbole»; ab 11 Farben wird sie einmal von selbst angeboten). Mögliche Symbole: circle, square, triangle, diamond, star,
  heart, drop, flower, cross, moon, ring, hexagon, bolt, leaf, bars, sun.
- Die ersten 8 Farben (`PRIMARY_COUNT`) werden bei wenigen Farben bevorzugt – dort nur sehr
  klar unterscheidbare Farben verwenden.
- Neue Farben **hinten anhängen** (sonst ändern sich bestehende Level). Ein Test verlangt einen
  Mindestabstand zu allen anderen Farben – bei Fehlschlag eine deutlichere Farbe wählen.
- Mehr Farben = mehr Gläser: Ein Level hat «Farben + 2» Gläser, die Darstellung schafft bis 16.

## Schwierigkeit – `data/levels.js`

- `ramp`: ab welchem Level wie viele Farben gelten und wie viele Züge die beste Lösung
  mindestens braucht (`minMoves`; zu einfache Würfe werden verworfen).
- `endless`: ab diesem Level wiederholt sich eine abwechslungsreiche Folge von Farbanzahlen.
- `features`: Besondere Level
  - `geheimnis` – verdeckte «?»-Schichten (nur die oberste Schicht ist sichtbar).
  - `gross` – einige Gläser fassen 5 oder 6 Schichten (pro Farbe gibt es trotzdem genau 4).
  - Ein Level hat die Eigenschaft, wenn `n >= from` und `(n - from) % every === 0`.
- `handmade`: Handgemachte Level haben Vorrang vor dem Generator. Beispiel:

  ```js
  7: {
    colors: ['rot', 'blau', 'gelb'],          // ids aus colors.js; a = erste Farbe, b = zweite …
    tubes: ['abca', 'bcab', 'cabc', '', ''],  // von UNTEN nach OBEN, '' = leeres Glas
    // '6:abc' = Glas mit Platz für 6 Schichten
    // hidden: true  → Geheimnis-Level, tutorial: true → mit Anleitungs-Pfeilen
  },
  ```

  Bei `hidden: true` ist in jedem Glas alles ausser der obersten Schicht verdeckt. Ein Glas,
  das schon fertig (4× dieselbe Farbe) ist, wird automatisch aufgedeckt; ebenso jedes Glas, das
  im Spiel voll und einfarbig wird – es bekommt dann seinen Korken.

  Jede Farbe muss genau 4-mal vorkommen; der Löser prüft beim Laden, ob das Level lösbar ist.

> Achtung: Wer `ramp`, `endless` oder `features` ändert, ändert bereits gespielte Level.
> Das ist erlaubt (gespeicherte Spielstände bleiben gültig), aber besser nur nach vorne erweitern.

## Kapitel – `data/chapters.js`

Alle 15 Level beginnt ein Kapitel mit Name, Emoji, sanftem Hintergrundverlauf (`bg`, hell
halten!) und Regalfarbe (`shelf`). Neue Kapitel hinten anhängen. Nach dem letzten Kapitel geht
es mit «II», «III» … von vorne los.

## Tagesrätsel – `data/daily.js`

Ein Eintrag pro Wochentag (0 = Sonntag): `name` (Untertitel im Menü), `colors`, optional
`gross: 'filled' | 'empty'` und `geheimnis: true`. Das Rätsel wird aus dem Datum erzeugt
(`todayKey()`), ist also für alle gleich und jeden Tag neu.

## Texte – `data/texts.js`

- `praise` – Lob im Gewinnblatt, `tips` – Tipps unten im Menü, `stuck` – Meldung bei einer
  Sackgasse (erscheint, wenn nur noch Hin-und-her-Züge möglich sind), `featureIntro` –
  Erklärungen beim ersten Geheimnis-/Grosse-Gläser-Level und das Angebot der Farbsymbole.
- `howTo` – die 3–4 Schritte des animierten Tutorials «So geht's» (gemeinsames
  `/shared/tutorial.js`): `title` (2–4 Wörter), `text` (ein kurzer Satz) und `demo` = Name der
  Mini-Szene in `view/tutorial.js` (`tap`, `rule`, `goal`, `help`). Eine neue Szene dort im
  Objekt `DEMOS` ergänzen (kleine SVG-Gläser über `demoTube`, Finger über `api.finger.tap`).
- Schweizer Rechtschreibung: immer «ss» (kein scharfes S), Anführungszeichen «so».

## Sterne

- 3 Sterne: höchstens «Ziel»-Züge (beste Lösung + ca. 15 %), ohne «+1 Glas».
- Mit «+1 Glas» höchstens 2 Sterne. Regeln in `logic/levels.js` → `starsFor`, `parTarget`.

## Aufbau des Codes (zur Orientierung)

| Datei | Inhalt |
| --- | --- |
| `logic/rules.js` | Spielregeln (giessen, rückgängig, gelöst?) – rein, ohne DOM |
| `logic/generator.js`, `logic/solver.js` | Level würfeln, optimale Lösung suchen, Tipps |
| `logic/levels.js` | Levelnummer/Datum → fertiges, geprüftes Level |
| `logic/worker.js`, `engine.js` | Rechnen im Hintergrund (Web Worker) |
| `view/board.js`, `view/glass.js` | Gläser, Giess-Animation, Korken, Partikel (Canvas) |
| `view/audio.js` | Gluckern, Korken-Plopp (WebAudio) |
| `app.js`, `style.css` | Menü, Spielbildschirm, Blätter, Speichern |
| `tests/` | `node --test`-Tests und `e2e.mjs` (Playwright, Port 8206) |

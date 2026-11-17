# Wortrate – Inhalte ergänzen

Wortrate lebt von seinen Wortlisten. Alle Listen liegen in `wordle/data/` und sind einfache
JavaScript-Dateien mit **einem langen Text**: die Wörter, getrennt durch Leerzeichen oder Zeilenumbrüche.

```js
// Kommentarzeilen beginnen mit //
export default `
ABEND ACKER ADLER AHORN ...
BLUME BLÜTE ...
`;
```

## Die Dateien

| Datei | Inhalt | Verwendung |
|---|---|---|
| `answers.js` | Lösungswörter, 5 Buchstaben (mind. 1500) | Tageswort und Endlos «Klassisch» |
| `allowed.js` | erlaubte Rateversuche, 5 Buchstaben | Prüfung «Nicht in der Wortliste» |
| `answers4.js` / `allowed4.js` | dasselbe mit 4 Buchstaben | Endlos «Kurz» |
| `answers6.js` / `allowed6.js` | dasselbe mit 6 Buchstaben | Endlos «Lang» |

- **Lösungswörter** sind gängige, freundliche Wörter, die man kennt (Nomen, Verben, Adjektive),
  keine Namen, keine Abkürzungen, nichts Derbes oder Trauriges.
- **Erlaubte Wörter** dürfen seltener sein (Beugungsformen, Fachwörter). Jedes Lösungswort gilt
  automatisch auch als erlaubt – es muss nicht doppelt eingetragen werden (schadet aber nicht).
- Ist in den Einstellungen «Alle Wörter erlauben» eingeschaltet, wird jede Buchstabenfolge angenommen.

## Regeln für Wörter

- Gross/klein ist egal, das Spiel schreibt alles gross.
- **Ä, Ö, Ü** sind eigene Buchstaben (eine Kachel). Also `BLÜTE` = 5 Buchstaben.
- Schweizer Rechtschreibung: **kein «ß»**, sondern «ss» (`GRÜSSE`, `STRASSE`).
- Nur Buchstaben A–Z, Ä, Ö, Ü – keine Bindestriche, Ziffern oder Akzente.
- Doppelte Einträge werden ignoriert (der Prüfer warnt aber).

## So fügst du Wörter hinzu

1. Datei öffnen, z.B. `wordle/data/answers.js`, Wort irgendwo dazuschreiben
   (alphabetisch ist schöner, aber nicht nötig).
2. Prüfen:
   ```sh
   node wordle/tools/check-words.mjs
   node --test wordle/tests/*.test.mjs
   ```
   Der Prüfer meldet falsche Längen, «ß», Doppelte und gesperrte Wörter
   (Sperrliste `BLOCKED` in `wordle/tools/check-words.mjs`).
3. Fertig. Das Spiel lädt die Listen beim nächsten Öffnen.

## Tageswort

Das Tageswort wird aus `answers.js` bestimmt: Die Liste wird alphabetisch sortiert und in Runden
gemischt (`dailyWord` in `wordle/logic.js`, Seed aus dem Datum). Innerhalb einer Runde
(so viele Tage, wie es Lösungswörter gibt) kommt kein Wort doppelt. **Achtung:** Wer Wörter
ergänzt oder entfernt, verändert die Reihenfolge der kommenden Tageswörter – für alle gleich,
also kein Problem, aber das heutige Wort kann sich dadurch ändern. Am besten neue Wörter
abends nach dem Spielen einchecken.

## Neue Wortlänge

Eine weitere Länge (z.B. 7) braucht:
1. `data/answers7.js` und `data/allowed7.js`,
2. Eintrag in `FILES` in `wordle/words.js` und `wordle/tools/check-words.mjs`,
3. die Zahl in `LENGTHS` (`wordle/logic.js`) und einen Namen in `LEN_NAMES` (`wordle/app.js`),
4. einen Statistik-Reiter in `openStats` (`wordle/app.js`).

## Gespeicherte Daten (localStorage, Präfix `spielpause.`)

| Schlüssel | Inhalt |
|---|---|
| `wordle.game.daily`, `wordle.game.e4/e5/e6` | laufendes Spiel je Modus (wird bei jeder Eingabe gespeichert) |
| `wordle.stats` | Statistik je Modus (`daily`, `e4`, `e5`, `e6`) |
| `wordle.used.<Länge>` | bereits gespielte Endlos-Wörter (keine Wiederholungen) |
| `wordle.settings` | schwerer Modus, alle Wörter erlauben, Kontrastfarben |
| `wordle.len` | zuletzt gewählte Wortlänge |

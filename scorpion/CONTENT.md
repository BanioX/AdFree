# Skorpion – Inhalte ergänzen

Skorpion braucht keine handgemachten Level: jede Austeilung entsteht aus einem Seed und wird
vom Löser geprüft. Die Spiele gehen nie aus und sind **garantiert lösbar**.

## Regeln in Kürze

- 7 Spalten à 7 Karten, in «Klassisch» liegen in den ersten vier Spalten je 3 Karten verdeckt.
- Bauen abwärts in **derselben Farbe**; jede offene Karte darf samt allem darüber bewegt werden.
- Leere Spalten nehmen nur Könige. Die 3 Reservekarten werden einmal ausgeteilt (auf Spalte 1–3).
- Liegt eine Farbe komplett vom König bis zum Ass, wird die Reihe abgeräumt. Vier Reihen = gewonnen.

## Wie eine Austeilung entsteht

- Schlüssel: `<variante>|<spielnummer>` oder `daily|<JJJJ-MM-TT>`.
- `logic/deals.js → findDeal(key, mode)` probiert `scorpion|<key>|0`, `…|1`, … bis die
  Bestensuche (`logic/solver.js`) gewinnt. Deterministisch: gleicher Schlüssel = gleiches Spiel.
- «Offen» braucht im Schnitt ~2 Versuche, «Klassisch» ~12 (Skorpion ist von Natur aus schwer –
  die meisten zufälligen Austeilungen sind unlösbar; der Löser sortiert sie aus).

## Varianten (`data/config.js`)

```js
export const MODES = [
  { id: 'leicht', label: 'Offen', sub: 'Alle Karten sichtbar', open: true },
  { id: 'klassisch', label: 'Klassisch', sub: 'Mit verdeckten Karten', open: false },
];
```

- `open: true` = alle Karten offen. Eine neue Variante (z.B. 4 Reservekarten) braucht eine
  Anpassung in `logic/rules.js` (`dealDeck`, `RESERVE`) und Tests.
- `DAILY_MODE`, `GEN_NODES`, `GEN_TRIES`: Variante des Tagesspiels und Suchbudget beim Prüfen.

## Kartenrücken und Tische

Gemeinsam für alle Kartenspiele in `/lib/cards/backs.js` und `/lib/cards/tables.js`.

## Prüfen

```sh
node --test scorpion/tests/*.test.mjs
python3 -m http.server 8302 --bind 127.0.0.1   # im Repo-Wurzelverzeichnis
node scorpion/tests/e2e.mjs
```

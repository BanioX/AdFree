# Bäckerdutzend – Inhalte ergänzen

Bäckerdutzend braucht keine handgemachten Level: jede Austeilung entsteht aus einem Seed und
wird vom Löser geprüft. Die Spiele gehen nie aus und sind **garantiert lösbar**.

## Regeln in Kürze

- 13 Stapel à 4 offene Karten («ein Bäckerdutzend»). Könige rutschen beim Austeilen in ihrem
  Stapel ganz nach unten.
- Immer nur die oberste Karte bewegen: auf eine Karte, die eins höher ist – die Farbe ist egal.
- Leere Stapel bleiben im klassischen Spiel leer; in «Leicht» darf jede Karte hinein.
- Ziel: alle Karten nach Farbe von Ass bis König auf die vier Ablagen.

## Wie eine Austeilung entsteht

- Schlüssel: `<variante>|<spielnummer>` oder `daily|<JJJJ-MM-TT>`.
- `logic/deals.js → findDeal(key, mode)` probiert `bakers|<key>|0`, `…|1`, … bis die
  Bestensuche (`logic/solver.js`) gewinnt – deterministisch, im Schnitt 1–2 Versuche.

## Varianten (`data/config.js`)

```js
export const MODES = [
  { id: 'klassisch', label: 'Klassisch', sub: 'Leere Stapel bleiben leer', free: false },
  { id: 'leicht', label: 'Leicht', sub: 'Leere Stapel frei belegbar', free: true },
];
```

- `free: true` = leere Stapel dürfen belegt werden. Weitere Regeln (z.B. Bauen nur in gleicher
  Farbe) brauchen eine Anpassung in `logic/rules.js` (`canMove`) und Tests.
- `DAILY_MODE`, `GEN_NODES`, `GEN_TRIES`: Variante des Tagesspiels und Suchbudget beim Prüfen.

## Kartenrücken und Tische

Gemeinsam für alle Kartenspiele in `/lib/cards/backs.js` und `/lib/cards/tables.js`.

## Prüfen

```sh
node --test bakers/tests/*.test.mjs
python3 -m http.server 8302 --bind 127.0.0.1   # im Repo-Wurzelverzeichnis
node bakers/tests/e2e.mjs
```

# Gipfel – Inhalte erweitern

Gipfel braucht keine handgemachten Level: jede Runde wird aus einem **Seed** gemischt
(`tripeaks|<modus>|<nummer>|<k>`) und – wenn «Nur lösbare Runden» an ist (Standard) – vom Löser
geprüft. Runde *n* ist auf jedem Gerät gleich, die Nummern gehen nie aus.

## Dateien

| Datei | Inhalt |
|---|---|
| `data/config.js` | Modi (mit/ohne Umlauf König ↔ Ass), Tagesrätsel-Modus, Lobestexte, Serien-Texte, Konfettifarben |
| `logic/rules.js` | Regeln (rein, ohne DOM): Geometrie der drei Gipfel, Zustand, Züge `play` / `draw`, Punkte (`SCORE`) |
| `logic/solver.js` | Tiefensuche mit Gedächtnis; liefert auch den «besten» Weg für Tipps in verfahrenen Stellungen |
| `logic/deals.js` | `findDeal()` – erster lösbarer Seed innerhalb eines festen Knoten-Budgets (`CHECK_NODES`) |
| `tutorial.js` | «So geht's» (4 animierte Schritte) |
| `../lib/cards/` | gemeinsame Karten-Bibliothek (Gesichter, Rücken, Tische, Tisch-Ansicht, Blätter) |

## Neuen Modus ergänzen

In `data/config.js` einen Eintrag zu `MODES` hinzufügen:

```js
{ id: 'profi', label: 'Profi', sub: 'ohne Umlauf', wrap: false },
```

`wrap: true` = König und Ass gelten als Nachbarn. Der Startbildschirm zeigt den Modus automatisch
im Segment-Schalter; Spielstand, Rundennummer und Statistik werden pro Modus geführt.

## Punkte anpassen

`SCORE` in `logic/rules.js`:

- `card` – Punkte pro Karte × aktuelle Serie (Serie = Karten seit dem letzten Talon-Zug),
- `peak` – Bonus für den 1., 2. und 3. abgeräumten Gipfel,
- `stockBonus` – pro übrige Talonkarte, wenn alle Gipfel weg sind.

`STREAK_WORDS` in `data/config.js` bestimmt, bei welcher Serienlänge ein Lob («Super!») erscheint.

## Tagesrätsel

`#daily` spielt den Seed `tripeaks|daily-JJJJ-MM-TT|0|k` im Modus `DAILY_MODE` – immer lösbar,
für alle gleich. Nach dem Abräumen wird `markDailyDone('tripeaks')` gesetzt.

## Testen

```sh
node --test tripeaks/tests/*.test.mjs           # Regeln, Punkte, Löser, 60 lösbare Runden je Modus, 45 Tage
python3 -m http.server 8301 --bind 127.0.0.1    # im Repo-Wurzelverzeichnis
node tripeaks/tests/e2e.mjs                      # Screenshots: tripeaks/tests/out/
```

Wird ein Modus sehr streng, findet `findDeal` seltener lösbare Seeds – dann `tries` oder
`CHECK_NODES` in `logic/deals.js` erhöhen und die Tests erneut laufen lassen.

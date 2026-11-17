# Pyramide – Inhalte erweitern

Pyramide braucht keine handgemachten Level: jede Partie wird aus einem **Seed** gemischt
(`pyramid|<modus>|<nummer>|<k>`) und – wenn «Nur lösbare Partien» an ist (Standard) – vom Löser
geprüft. Partie *n* ist auf jedem Gerät gleich, die Nummern gehen nie aus.

## Dateien

| Datei | Inhalt |
|---|---|
| `data/config.js` | Modi (Schwierigkeit = wie oft neu ausgelegt werden darf), Tagesrätsel-Modus, Lobestexte, Konfettifarben |
| `logic/rules.js` | Regeln (rein, ohne DOM), Zustand, Züge `rm` / `draw` / `redeal` |
| `logic/solver.js` | Tiefensuche mit Gedächtnis, Könige sofort, Sackgassen-Erkennung |
| `logic/deals.js` | `findDeal()` – erster lösbarer Seed innerhalb eines festen Knoten-Budgets |
| `tutorial.js` | «So geht's» (4 animierte Schritte) |
| `../lib/cards/` | gemeinsame Karten-Bibliothek (Gesichter, Rücken, Tische, Tisch-Ansicht, Blätter) |

## Neuen Modus ergänzen

In `data/config.js` einen Eintrag zu `MODES` hinzufügen:

```js
{ id: 'schwer', label: 'Schwer', sub: 'ohne Neuauslegen', redeals: 0 },
```

`redeals` = wie oft der Ablagestapel nach dem letzten Talon-Blatt wieder umgedreht werden darf.
Der Startbildschirm zeigt den Modus automatisch im Segment-Schalter, Statistik und Spielstand
werden pro Modus geführt. Danach Tests laufen lassen – sie prüfen für **jeden** Modus 60 Partien
auf Lösbarkeit:

```sh
node --test pyramid/tests/*.test.mjs
```

Sehr strenge Modi (z.B. `redeals: 0`) haben wenige lösbare Seeds; `findDeal` sucht dann länger
(höchstens `tries` Kandidaten). Bei Bedarf `CHECK_NODES` in `logic/deals.js` erhöhen.

## Tagesrätsel

`#daily` spielt den Seed `pyramid|daily-JJJJ-MM-TT|0|k` im Modus `DAILY_MODE` – immer lösbar,
für alle gleich. Nach dem Abräumen wird `markDailyDone('pyramid')` gesetzt.

## Lobestexte, Farben

`PRAISE` (Überschriften im Gewinnblatt) und `CONFETTI` einfach ergänzen. Kartenrücken und Tische
liegen gemeinsam für alle Kartenspiele in `lib/cards/backs.js` und `lib/cards/tables.js`.

## Testen

```sh
python3 -m http.server 8301 --bind 127.0.0.1    # im Repo-Wurzelverzeichnis
node pyramid/tests/e2e.mjs                       # Screenshots: pyramid/tests/out/
```

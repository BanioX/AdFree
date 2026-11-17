# Golf-Patience – Inhalte erweitern

Golf-Patience braucht keine handgemachten Level: jedes Loch wird aus einem **Seed** gemischt
(`golf|<modus>|<runde>|<loch>|<k>`) und – wenn «Nur abräumbare Löcher» an ist (Standard) – vom
Löser geprüft. Eine Runde hat 9 Löcher; Runde *r*, Loch *h* ist auf jedem Gerät gleich, die
Runden gehen nie aus.

## Dateien

| Datei | Inhalt |
|---|---|
| `data/config.js` | Modi (mit/ohne Umlauf König ↔ Ass), Löcher pro Runde, Modus des Lochs des Tages, Rundentitel, Konfettifarben |
| `logic/rules.js` | Regeln (rein, ohne DOM), Zustand, Züge `play` / `draw`, Schläge (`holeScore`), Golf-Begriffe (`scoreName`) |
| `logic/solver.js` | `clearPath()` – Weg zum Abräumen (kennt den Talon); `fairPlay()` – guter Spieler ohne Blick in den Talon |
| `logic/deals.js` | `findHole()` – erster abräumbarer Seed; `parOf()` – Par = fairer Spieler + 1 (mindestens 1) |
| `tutorial.js` | «So geht's» (4 animierte Schritte) |
| `../lib/cards/` | gemeinsame Karten-Bibliothek (Gesichter, Rücken, Tische, Tisch-Ansicht, Blätter) |

## Schläge und Par

- Ein Loch zählt die Karten, die in den Reihen liegen bleiben. Wer alle Reihen abräumt, bekommt
  **minus** die übrigen Talonkarten (z.B. −3).
- Das Par jedes Lochs rechnet der «faire Spieler» aus (spielt gut, sieht aber den Talon nicht)
  plus 1. Die Test-Suite prüft, dass das Par im Mittel weder zu streng noch geschenkt ist.
- Begriffe (Birdie, Eagle, Albatros, Bogey …) stehen in `scoreName()` in `logic/rules.js`,
  Rundentitel in `roundTitle()` in `data/config.js`.

## Neuen Modus ergänzen

In `data/config.js` einen Eintrag zu `MODES` hinzufügen:

```js
{ id: 'profi', label: 'Profi', sub: 'ohne Umlauf', wrap: false },
```

Der Startbildschirm zeigt den Modus automatisch im Segment-Schalter; Spielstand, Runden und
Statistik werden pro Modus geführt. Eine andere Rundenlänge: `HOLES` in `data/config.js`.

## Loch des Tages

`#daily` spielt den Seed `golf|daily-JJJJ-MM-TT|0|1|k` im Modus `DAILY_MODE` – immer abräumbar,
für alle gleich. Nach dem Abräumen wird `markDailyDone('golf')` gesetzt.

## Testen

```sh
node --test golf/tests/*.test.mjs               # Regeln, Löser, fairer Spieler, Par, abräumbare Löcher, 30 Tage
python3 -m http.server 8301 --bind 127.0.0.1    # im Repo-Wurzelverzeichnis
node golf/tests/e2e.mjs                          # Screenshots: golf/tests/out/
```

Wird ein Modus sehr streng, findet `findHole` seltener abräumbare Seeds – dann `tries` oder
`CHECK_NODES` in `logic/deals.js` erhöhen und die Tests erneut laufen lassen.

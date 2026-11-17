# Zahlensummen – Inhalte

Alle Rätsel werden aus einem **Seed** erzeugt (`logic/puzzle.js`), es gibt also keine
Rätsel-Listen zu pflegen. Was du anpassen kannst, steht in **`data/difficulties.js`**.

## Was ein Rätsel garantiert

- **Genau eine Lösung** – geprüft mit einem vollständigen Löser (`solve`). Ist ein Rätsel
  mehrdeutig, ändert der Generator eine Ziffer, in der sich zwei Lösungen unterscheiden,
  und prüft erneut.
- **Ohne Raten lösbar** – zusätzlich muss reine «Linien-Logik» (`logicSolve`) das Rätsel
  ganz lösen: In einer Reihe/Spalte/einem Bereich werden alle Kombinationen der offenen
  Zahlen geprüft, die zur Restsumme passen. Dieselbe Logik liefert die Tipps
  («Reihe 3: Die 7 muss weg»).
- Jede Reihe, Spalte und jeder Farbbereich behält mindestens eine Zahl (Summe > 0).

Seeds: `numbersums-<stufe>-<nummer>` und `numbersums-daily-<JJJJ-MM-TT>` (für alle gleich).

## Stufen anpassen (`data/difficulties.js`)

```js
{ id: 'schwer', title: 'Schwer', n: 7, regions: true, keepRate: 0.5, blurb: '7×7 · mit Farbbereichen' }
```

| Feld       | Bedeutung |
|------------|-----------|
| `id`       | interner Name (Speicherplatz, Seed) – nach dem Veröffentlichen nicht mehr ändern |
| `title`    | Anzeige im Menü (Schweizer Rechtschreibung) |
| `n`        | Grösse n×n (5–8 passt gut aufs iPhone; 9 geht, wird aber eng) |
| `regions`  | `true` = zusätzliche Farbbereiche mit eigener Summe |
| `keepRate` | Anteil der Zahlen, die bleiben (0.45–0.55 fühlt sich gut an) |

`DAILY` legt das Tagesrätsel fest, `REGION_COLORS` die Bereichsfarben
(`[Hintergrund, Schrift/Rand]`, Nachbarbereiche bekommen nie dieselbe Farbe), `LIVES` die Herzen.

## Testen

```bash
node --test numbersums/tests/*.test.mjs        # Eindeutigkeit, ohne Raten lösbar, Tipps, Leben
python3 -m http.server 8304 --bind 127.0.0.1    # im Repo-Wurzelverzeichnis
node numbersums/tests/e2e.mjs                   # Ablauf auf dem iPhone 13 (Screenshots in tests/out/)
```

Die Logik-Tests erzeugen pro Stufe 40 Rätsel und prüfen alle Garantien oben. Nach einer
Änderung an `difficulties.js` einfach wieder laufen lassen.

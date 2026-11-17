# Zahlen-Familie (`/lib/numbers/`)

Gemeinsamer Code für Zahlenpaare, Zahlensummen und Zahlenschlange.

| Datei          | Inhalt |
|----------------|--------|
| `grid.js`      | `CellGrid` (Zahlengitter mit Treffer-Test, Coach-Ring, Kurzanimationen), `bindPointer` (Tippen + Ziehen über Zellen), `renderNotes` (kleine Merkzahlen) |
| `pad.js`       | `numPad` (Zahlentasten mit Notiz-Schalter), `popover` (Sprechblase neben einer Zelle) |
| `hud.js`       | Spielkopfzeile, Uhr, Herzen, Werkzeugknöpfe (`toolButton`, `onPress`), Gewinn-/«Schade»-Blatt, Router, Statistik-Speicher, Coach-Sprechblase |
| `icons.js`     | zusätzliche Linien-Icons (Radierer, Stift, Glühbirne …) |
| `numbers.css`  | Styles für alles oben; im Spiel nach `shared/style.css` laden |

Farben kommen aus `--accent` des jeweiligen Spiels. Knöpfe reagieren über `onPress` schon beim
Loslassen, weil `setupPage()` schnelle Doppeltipps (<320 ms) sonst verschluckt.

# Brettspiel-Familie (`/lib/board/`)

Gemeinsamer Code für Vier in einer Reihe, Reversi, Dame, Mühle, Kalaha, Gomoku,
Schach und die übrigen Spiele gegen den Computer.

| Datei | Inhalt |
|---|---|
| `ai.js` | `pickMove` – Negamax mit Alpha-Beta, drei Stärken (leicht, mittel, schwer) |
| `kit.js` | Startbildschirm, Statistik, Spielfläche (`stage`, `fillTools`), Gewinnblatt |
| `board.css` | Kopfzeile, Status, Werkzeugleiste. Im Spiel nach `shared/style.css` laden |

Jedes Spiel bringt eigene Regeln, eigenes Brett und eigene Grafik mit. Farben über `--accent`.

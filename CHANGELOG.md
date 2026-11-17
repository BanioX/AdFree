# Versionsverlauf

Was in Spielpause neu dazukommt. Neueste Einträge oben.

## 17. November 2026 (Nacht)

### Neu (Grok)
- **Vier in einer Reihe**: gegen den Computer in drei Stärken, mit Tipp, Rückgängig und gespeicherter Partie.

## 17. November 2026 (Abend)

### Neu
- **Farbenzauber** fertig: 20 handgezeichnete Bilder (Blumen, Tiere, Landschaften, Essen, Winter),
  Mandalas, Buntglas, Low Poly, eigene Fotos; neuer Startbildschirm mit «Weitermalen», animierte Anleitung.
- **Pfeilwürfel** fertig: neuer Startbildschirm, animierte Anleitung, Modus «Entspannt», Statistik.

### Behoben
- Schnelle Taps gingen in allen Spielen manchmal verloren (jeder zweite Tap innerhalb von 0,3 s).
- Unfertige Spiele öffneten einen Download-Dialog – jetzt «Bald»-Kachel und freundliche Hinweisseite.

### Verbessert
- **Ton komplett neu:** viel leiser und sanfter (weiche Glockentöne statt Piepsen), Menü-Knöpfe sind
  stumm, schnelle Wiederholungen werden gedrosselt. Auf dem iPhone gilt jetzt der **Stumm-Schalter**,
  und laufende Musik wird nicht mehr unterbrochen. Ton-Knopf: **leise** (Standard) → normal → aus.
- **Startseite für viele Spiele:** Suche, **Favoriten** (langes Drücken auf eine Kachel),
  «Zuletzt gespielt» und Abschnitte pro Kategorie.

### Geplant
- **Fahrplan zu 100 Spielen** veröffentlicht: siehe [ROADMAP.md](ROADMAP.md).

## 17. November 2026

### Neu
- **Spielkatalog** als Startseite: 4 Kacheln pro Reihe, Kategorien (Kreativ, Logik, Karten & Steine,
  Wörter, Kombinieren), Info-Blatt per langem Drücken, «Neu»-Abzeichen für neue Spiele.
- **Tagesrätsel** für Sudoku, Bilderrätsel, Farbfluss, Solitär, Mahjong, Wortsuche und Wortrate –
  mit Häkchen und Serien-Zähler auf der Startseite.
- **16 Spiele** in Arbeit: Farbenzauber, Perlenbild, Puzzle, Pfeilwürfel, Sudoku, Bilderrätsel,
  Farbfluss, Blockpuzzle, Verdoppeln, Solitär, Mahjong, Dreierlei, Wortsuche, Wortrate, Juwelen,
  Blasenzauber.
- **Einheitlicher Startbildschirm** für alle Spiele (`shared/gamemenu.js`) und **kurze animierte
  Anleitung** mit tippendem Finger (`shared/tutorial.js`).
- **Veröffentlichung** über Cloudflare Workers (`wrangler.jsonc`) und GitHub Pages; Offline-Betrieb
  über Service Worker.
- App-Icon und Kachel-Icons.

### Stand
- Spielbar (im Feinschliff): Farbenzauber, Perlenbild, Pfeilwürfel, Solitär, Mahjong, Dreierlei,
  Sudoku, Bilderrätsel, Farbfluss, Blockpuzzle, Verdoppeln, Wortsuche, Wortrate.
- Im Bau: Juwelen, Blasenzauber, Puzzle.

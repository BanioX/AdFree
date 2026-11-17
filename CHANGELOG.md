# Versionsverlauf

Was in Spielpause neu dazukommt. Neueste Einträge oben.

## 17. November 2026 (Nacht)

### Neu (Grok)
- **Sprache**: Vier in einer Reihe, Reversi, Kalaha, Fünf in einer Reihe, Dame, Mühle und Eile mit Weile sind auf Deutsch und Englisch (`shared/i18n.js`, Schalter DE/EN).
- **Vier in einer Reihe**: gegen den Computer in drei Stärken, mit Tipp, Rückgängig und gespeicherter Partie.
- **Reversi**: schwarz gegen den Computer, Steine umdrehen, drei Stärken.
- **Kalaha**: Samen säen, Extra-Zug und Fangen, drei Stärken.
- **Fünf in einer Reihe**: 13×13, fünf Steine in einer Linie, drei Stärken.
- **Dame**: deutsche Regeln, Schlagzwang und fliegende Damen, drei Stärken.
- **Mühle**: neun Steine, Mühle schliessen, fliegen mit drei Steinen, drei Stärken.
- **Eile mit Weile**: kurze Runde mit zwei Figuren gegen drei Farben, drei Stärken.
- **Schiffe versenken**: Flotte 5-4-3-3-2 ohne Berührung, Treffer gibt einen weiteren Schuss, drei Stärken. Deutsch und Englisch.
- **Schach**: legale Züge mit Rochade, en passant und Umwandlung, drei Stärken. Deutsch und Englisch.
- **Backgammon**: ohne Verdopplungswürfel, schlagen und abtragen, drei Stärken. Deutsch und Englisch.

### Behoben (Grok)
- **Vier in einer Reihe**: Tippen auf eine Reihe legt wieder einen Stein (iPhone). Der Tipp hebt die Reihe nur hervor.
- Reversi, Kalaha, Fünf in einer Reihe und Dame nehmen Tippen auch an, wenn das iPhone nur einen Klick schickt.

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

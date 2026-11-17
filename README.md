# Spielpause

**56 entspannte Spiele in einer App – ganz ohne Werbung, ohne Käufe, ohne Konto.**

Spielpause ist eine Web-App (PWA) für das iPhone: im Safari öffnen, auf den Home-Bildschirm legen,
und sie startet wie eine normale App – im Vollbild und auch offline. Alle Spielstände bleiben auf dem Gerät.

▶️ **Testen:** <https://baniox.github.io/AdFree/>
(oder die eigene Cloudflare-Adresse `https://adfree.<konto>.workers.dev`, siehe [Veröffentlichen](#veröffentlichen))

---

## Die Spiele

Die Startseite ist ein **Spielkatalog** mit 4 Kacheln pro Reihe. Die Spiele sind nach **Erbauer**
gruppiert («Gebaut mit Claude», «Gebaut mit Grok»), jede Kachel mit einem kleinen Zeichen. Suche,
Favoriten (langes Drücken auf eine Kachel), «Zuletzt gespielt» und die Kategorien bleiben – als Filter
und als Untergruppen. Dazu eine Leiste mit den **Tagesrätseln** (jeden Tag neu, mit Serien-Zähler).
Der **Ton** ist leise und sanft, hält sich an den Stumm-Schalter des iPhones und lässt sich mit dem
Lautsprecher-Knopf auf leise / normal / aus stellen.

| Spiel | Kategorie | Worum es geht | Inhalt | Tagesrätsel |
|---|---|---|---|:-:|
| 🎨 **Farbenzauber** | Kreativ | Malen nach Zahlen: Farbe wählen, nummerierte Flächen antippen | handgezeichnete Bilder, endlose Mandalas, Buntglas & Low-Poly, **eigene Fotos** als Malvorlage | |
| 💎 **Perlenbild** | Kreativ | Glitzersteine aus dem Vorrat sortieren und ein Pixelbild legen | ~36 Motive, **eigene Fotos** | |
| 🧩 **Puzzle** | Kreativ | Klassisches Puzzle mit 12–108 Teilen | erzeugte Gemälde, Bilder aus Farbenzauber, **eigene Fotos** | |
| 🧊 **Pfeilwürfel** | Logik | 3D-Würfel drehen, freie Pfeile hinausgleiten lassen | unendlich viele Level | |
| 🔢 **Sudoku** | Logik | Zahlen 1–9 logisch einsetzen, mit Notizen und erklärenden Tipps | 4 Schwierigkeitsstufen, unendlich | ✓ |
| 🖼️ **Bilderrätsel** | Logik | Nonogramme: Zahlenhinweise lösen, farbiges Bild entdecken | über 100 Rätsel, 5×5 bis 20×20 | ✓ |
| 🧪 **Farbfluss** | Logik | Farben in Gläser umgiessen, bis jedes Glas eine Farbe hat | unendlich viele Level in Kapiteln | ✓ |
| 🟧 **Blockpuzzle** | Logik | Teile aufs Brett ziehen, Reihen füllen und abräumen | Endlos-Modus + Abenteuer-Level | |
| ✨ **Verdoppeln** | Logik | Gleiche Kacheln zusammenschieben und wachsen lassen | mehrere Brettgrössen, Motiv-Sets (Früchte, Tiere …) | |
| 🃏 **Solitär** | Karten & Steine | Klondike, Spider und FreeCell | nur lösbare Partien, Kartendesigns | ✓ |
| 🀄 **Mahjong** | Karten & Steine | Gleiche freie Steine paarweise abräumen | über 24 Layouts als Reise, 3 Steinsets | ✓ |
| 🍓 **Dreierlei** | Karten & Steine | Drei gleiche Steine sammeln, die Ablage nicht überfüllen | unendlich viele Level, 12+ Themen | |
| 🔤 **Wortsuche** | Wörter | Versteckte Wörter im Buchstabengitter finden | über 80 deutsche Themen | ✓ |
| 🟩 **Wortrate** | Wörter | Das deutsche 5-Buchstaben-Wort in sechs Versuchen | Tageswort + Endlos-Modus | ✓ |
| 💠 **Juwelen** | Kombinieren | Drei Gleiche in einer Reihe, Spezialsteine, Ziele | über 150 Level | |
| 🫧 **Blasenzauber** | Kombinieren | Blasen zielen und abschiessen, Gruppen platzen lassen | über 150 Level + Endlos-Modus | |
| 🟡 **Vier in einer Reihe** | Brettspiele | Vier gleiche Steine in einer Linie | gegen den Computer, drei Stärken | |
| ⚫ **Reversi** | Brettspiele | Gegnerische Steine einschliessen und umdrehen | gegen den Computer, drei Stärken | |
| 🟤 **Kalaha** | Brettspiele | Samen säen und den eigenen Vorrat füllen | gegen den Computer, drei Stärken | |
| ⚪ **Fünf in einer Reihe** | Brettspiele | Fünf Steine in einer Linie | gegen den Computer, drei Stärken | |
| 🟠 **Dame** | Brettspiele | Steine schlagen, auf der letzten Reihe wird die Dame | gegen den Computer, drei Stärken | |
| 🟤 **Mühle** | Brettspiele | Drei Steine in einer Linie, einen gegnerischen Stein nehmen | gegen den Computer, drei Stärken | |
| 🔴 **Eile mit Weile** | Brettspiele | Vier Farben, eine 6 holt dich raus | gegen den Computer, drei Stärken | |
| 🚢 **Schiffe versenken** | Brettspiele | Flotte setzen und die gegnerischen Schiffe finden | gegen den Computer, drei Stärken | |
| ♟️ **Schach** | Brettspiele | Weiss gegen den Computer, mit Rochade und Umwandlung | gegen den Computer, drei Stärken | |
| 🎲 **Backgammon** | Brettspiele | Würfeln, ziehen, schlagen und abtragen | gegen den Computer, drei Stärken | |
| 🟣 **Wortkreis** | Wörter | Wörter aus einem Buchstabenrad legen | drei Stufen, deutsch und englisch | |
| 🟡 **Wabenwort** | Wörter | Sieben Buchstaben, die Mitte muss ins Wort | drei Stufen, deutsch und englisch | |
| 🌸 **Buchstabenjagd** | Wörter | Das Wort Buchstabe für Buchstabe finden | sieben Fehlversuche, deutsch und englisch | |
| 🔴 **Anagramm** | Wörter | Buchstaben in die richtige Reihenfolge legen | drei Stufen, deutsch und englisch | |
| 🟢 **Wortleiter** | Wörter | Ein Buchstabe pro Stufe bis zum Zielwort | drei Stufen, deutsch und englisch | |
| 🔵 **Geheimschrift** | Wörter | Einen kurzen Satz entschlüsseln | drei Stufen, deutsch und englisch | |
| 🟢 **Wortwirbel** | Wörter | Wörter im Buchstabenfeld finden, auch schräg | ohne Uhr, Zeit freiwillig, deutsch und englisch | |
| 🔵 **Kreuzworträtsel** | Wörter | Ein kleines Gitter mit eigenen Hinweisen | 7×7, deutsch und englisch | |
| 🟡 **Emoji-Rätsel** | Wörter | Ein Bild mit Buchstaben aus dem Korb erraten | eigene Listen, deutsch und englisch | |
| 🟢 **Minensucher** | Logikrätsel | Zahlen lesen und die Minen meiden | Fahne, ohne Uhr, deutsch und englisch | |
| 🔵 **Brücken** | Logikrätsel | Inseln verbinden, ohne dass sich Brücken kreuzen | Zahl auf der Insel, deutsch und englisch | |
| 🔵 **Binärrätsel** | Logikrätsel | Gleich viele Nullen und Einsen, ohne drei gleiche | 6×6 und 8×8, deutsch und englisch | |
| 🟡 **Lichter aus** | Logikrätsel | Ein Tipp schaltet das Licht und die Nachbarn | ohne Uhr, deutsch und englisch | |
| 🟣 **Grösser-Kleiner** | Logikrätsel | Zahlenquadrat, das Zeichen zeigt zur kleineren Zahl | 4×4 und 5×5, deutsch und englisch | |
| 🔴 **Früchte-Fusion** | Kombinieren | Früchte fallen lassen, gleiche verschmelzen | ohne Uhr, deutsch und englisch | |
| 🔵 **Kugelkette** | Kombinieren | Drei gleiche Kugeln weg tippen | die Lücke schliesst sich, deutsch und englisch | |
| 🔴 **Farbklicker** | Kombinieren | Die Ecke frisst die getippte Farbe | ohne Zuglimit, deutsch und englisch | |
| 🟣 **Farbkugeln** | Kombinieren | Kugeln schieben, fünf in einer Reihe räumen | auch schräg, deutsch und englisch | |
| 🟢 **Schlängel** | Kombinieren | Richtung tippen und Futter sammeln | ohne harten Absturz, deutsch und englisch | |
| 🟠 **Mauerbrecher** | Kombinieren | Schläger ziehen und Steine treffen | der Ball kommt zurück, deutsch und englisch | |
| 🟤 **Turmbau** | Kombinieren | Blöcke fallen lassen und stapeln | genauer Treffer behält die Breite, deutsch und englisch | |
| 🔵 **Fallende Blöcke** | Kombinieren | Blöcke schieben, drehen und Reihen leeren | langsamer Fall, deutsch und englisch | |
| 🔵 **Sternenhimmel** | Logikrätsel | Ein Stern pro Zeile, Spalte und Gebiet | ohne Berührung, deutsch und englisch | |
| 🟢 **Zelte & Bäume** | Logikrätsel | Neben jedem Baum steht ein Zelt | Zahlen am Rand, deutsch und englisch | |
| 🔵 **Hochhäuser** | Logikrätsel | Wie viele Häuser sieht man von aussen? | 4×4 und 5×5, deutsch und englisch | |
| 🟢 **Inseln** | Logikrätsel | Die Zahl ist eine Insel dieser Grösse | Wasser verbunden, deutsch und englisch | |
| 🟣 **Rundweg** | Logikrätsel | Eine Schlaufe, die Zahlen zählen die Kanten | 5×5 und 6×6, deutsch und englisch | |
| 💗 **Riesenjagd** | Retro-Ecke | Kleines Schiff gegen riesige Mechs | vier Bosse, drei Tempi, deutsch und englisch | |
| 🩵 **Ausweichen** | Retro-Ecke | Strahlen und Kanonen überstehen | drei Riesen, der Balken wird müde, deutsch und englisch | |
| 💚 **Sternkater** | Retro-Ecke | Held und Katze gegen riesige Bosse | seitlich, springen und schiessen, deutsch und englisch | |

Jedes Spiel bekommt einen einheitlichen **Startbildschirm** (ein Knopf zum Weiterspielen, Tagesrätsel,
Modus, Statistik) und eine **kurze, animierte Anleitung** («So geht's»), die beim ersten Start
automatisch erscheint und jederzeit über **?** erreichbar ist.

> **Ziel: 100 Spiele.** Welche Spiele noch kommen, steht im [Fahrplan](ROADMAP.md).
>
> **Stand:** Alle 16 ersten Spiele sind spielbar und getestet; der einheitliche Startbildschirm und
> der Spass-Check werden Spiel für Spiel eingebaut, neue Wellen kommen laufend dazu. Was neu dazukommt, steht im
> [Versionsverlauf](CHANGELOG.md).

## Auf dem iPhone installieren

1. Den Link oben in **Safari** öffnen.
2. Unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben) tippen.
3. **«Zum Home-Bildschirm»** wählen → **Hinzufügen**.

Fertig – «Spielpause» liegt jetzt als App auf dem Home-Bildschirm.

- **Updates** kommen automatisch. Weil die App offline funktioniert, zeigt sie nach einem Update
  beim ersten Öffnen manchmal noch die alte Version – einfach schliessen und erneut öffnen.
- **Spielstände** liegen nur auf dem jeweiligen Gerät und nur unter der jeweiligen Adresse.
  Also nur **eine** Adresse auf den Home-Bildschirm legen. Wer in Safari die Website-Daten löscht,
  löscht auch die Spielstände.

## Veröffentlichen

Spielpause ist eine rein statische Website. Jeder Push auf **`main`** wird automatisch veröffentlicht.

### Cloudflare (Workers)

Cloudflare Dashboard → **Workers & Pages** → **Create** → Repository **BanioX/AdFree** verbinden:

| Feld | Wert |
|---|---|
| Project name | `adfree` (muss zu `name` in [`wrangler.jsonc`](wrangler.jsonc) passen) |
| Build command | leer lassen (oder `node tools/build-site.mjs`) |
| Deploy command | `npx wrangler deploy` |
| Production branch | `main` (Settings → Build → Branch control) |

`wrangler.jsonc` baut die App bei jedem Deploy automatisch nach `dist/` und liefert sie von dort aus.
Die Adresse steht im Cloudflare-Dashboard unter Overview → Worker URL (`https://adfree.<konto>.workers.dev`).

*(Klassisches Cloudflare Pages geht auch: Build command `node tools/build-site.mjs`, Output `dist`.)*

### GitHub Pages

GitHub → **Settings** → **Pages** → Source **«GitHub Actions»**. Der Workflow
[`.github/workflows/pages.yml`](.github/workflows/pages.yml) baut und veröffentlicht jeden Push auf `main`
unter <https://baniox.github.io/AdFree/>.

## Erweitern

Die App ist darauf ausgelegt, stetig zu wachsen. Mehrere KI-Agenten bauen parallel daran
(Claude: bestehende Spiele + Welle 1, Grok: Welle 2, Welle 3 und die Retro-Bosse). Die Startseite
gruppiert danach. Die gemeinsamen Regeln stehen in [`AGENTS.md`](AGENTS.md), Probleme in fremden
Spielen in [`HINWEISE.md`](HINWEISE.md).

- **Neues Spiel:** Ordner `/<id>/` anlegen, Kachel-Icon `/icons/games/<id>.svg` zeichnen, Eintrag in
  [`games.js`](games.js) ergänzen (inkl. `builder`) – die Startseite zeigt es automatisch (14 Tage mit «Neu»-Abzeichen).
  Startbildschirm und Anleitung kommen aus den gemeinsamen Bausteinen. Details und Regeln: [`DEV.md`](DEV.md).
- **Neuer Inhalt für ein bestehendes Spiel** (Bilder, Level, Wortlisten, Themen, Layouts): liegt als
  einfache Datendatei im Ordner `/<spiel>/data/`. Jedes Spiel erklärt in seiner `CONTENT.md`, wie man
  Inhalte hinzufügt, z.B. [Sudoku](sudoku/CONTENT.md), [Solitär](solitaire/CONTENT.md),
  [Farbfluss](sort/CONTENT.md), [Bilderrätsel](nonogram/CONTENT.md), [Verdoppeln](merge/CONTENT.md).
- Die meisten Spiele **erzeugen ihre Level selbst** (deterministisch und garantiert lösbar) – der Inhalt geht nie aus.


## Aufbau des Projekts

```
index.html            Startseite (Spielkatalog)
games.js              Verzeichnis aller Spiele (Titel, Kategorie, Erbauer, Farbe, Tagesrätsel)
shared/               gemeinsame Bausteine: Styles, Speicher, Sounds, Dialoge,
                      Startbildschirm (gamemenu.js), Tutorial (tutorial.js)
<spiel>/              ein Ordner pro Spiel (index.html, app.js, data/, tests/, CONTENT.md)
icons/                App-Icons und Kachel-Icons (icons/games/<id>.svg)
sw.js                 Service Worker (offline)
manifest.webmanifest  PWA-Manifest
tools/                Werkzeuge: build-site.mjs (baut dist/), make-icons.mjs, demo-menu.html
wrangler.jsonc        Cloudflare-Konfiguration
DEV.md                Entwickler-Leitfaden (Regeln, Datenformate, Tests)
AGENTS.md             Regeln und Zuständigkeiten für alle KI-Agenten
CHANGELOG.md          Versionsverlauf
ROADMAP.md            Fahrplan zu 100 Spielen
```

## Lokal entwickeln

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten:

```bash
python3 -m http.server 8000      # dann http://localhost:8000 öffnen
node --test */tests/*.test.mjs   # Logik-Tests der Spiele
node tools/build-site.mjs        # Auslieferungsversion nach dist/ bauen
```

Der Service Worker ist lokal nur mit `?sw=1` aktiv (kein Cache-Ärger beim Entwickeln).

# Mahjong – Inhalte ergänzen

Alle Inhalte liegen in `/mahjong/data/`. Nach jeder Änderung die Tests laufen lassen:

```sh
node --test mahjong/tests/*.test.mjs        # Format, Passform, Lösbarkeit, Steinsätze, Tagesrätsel
node mahjong/tests/layout-stats.mjs         # Übersicht: Steinzahl, Grösse, Steinbreite auf dem iPhone
```

## Layouts (`data/layouts.js`) – die «Reise»

Die Reihenfolge im Array ist die Reihenfolge der Reise (leicht → schwer, klein → gross).
Jedes Layout ist ein Objekt:

```js
{
  id: 'kleeblatt',          // eindeutig, nur a-z, 0-9 und '-' (wird für Fortschritt/Sterne gespeichert – nie umbenennen!)
  name: 'Kleeblatt',        // deutscher Anzeigename, höchstens 18 Zeichen, Schweizer Rechtschreibung (ss statt ß)
  layers: [                 // Ebene 0 liegt unten, jede weitere Ebene darauf
    ['XXXX',                // eine Ebene = Zeilen; 'X' = Stein, '.' = leer
     'XXXX'],
    ['.XX.'],
    { rows: ['X'], dx: 1.5, dy: 0.5, z: 2 },   // Objekt-Form: halbe Versätze dx/dy (in Steinen), z = Höhe
  ],
}
```

Regeln (prüft `tests/content.test.mjs`):

- **Gerade** Anzahl Steine, mindestens 24, höchstens 144.
- Jeder Stein ab Ebene 1 muss auf einem Stein darunter liegen (kein Schweben), keine Überlappungen.
- Passform: auf dem iPhone (390 × 560 px Spielfläche) müssen die Steine ohne Zoom **mindestens 26 px**
  breit sein. Faustregel Hochformat: höchstens ~11 Steine breit und ~15 Reihen hoch.
- Lösbarkeit muss man nicht selbst sicherstellen: Der Generator verteilt die Bilder immer so, dass
  das Brett aufgeht (rückwärts aufgebaut, mit Lösungs-Zertifikat).

Sterne: ★★★ ohne Tipp und Mischen, ★★ mit höchstens zwei Hilfen, sonst ★. «Rückgängig» ist gratis.
Freigeschaltet sind immer die nächsten drei noch nicht geschafften Layouts.

## Steinsätze (`data/tilesets.js`)

Jeder Satz hat genau **42 Bilder**: 34 normale (`faces`, gleiche Bilder passen zusammen) und zwei
Gruppen mit je 4 Bildern (`bonus`, jedes Bild passt zu jedem seiner Gruppe – wie Blumen und
Jahreszeiten). Bonus-Steine bekommen automatisch einen farbigen Rand.

Neuen Emoji-Satz hinzufügen – einfach ein Objekt anhängen:

```js
{
  id: 'meer', name: 'Meer', kind: 'emoji',
  edge: '#3f8ef0', edgeDark: '#2a5fa8',          // Farbe der Steinseite und ihr Schatten
  faces: ['🐟', '🐠', /* … genau 34 verschiedene … */],
  bonus: [['🐚', '🦀', '🦐', '🦑'], ['⛵', '⚓', '🏝️', '🌊']],
  bonusNames: ['Muscheln & Co.', 'Hafen'],        // erscheinen im Tutorial
}
```

- Keine doppelten Emoji im ganzen Satz, gut unterscheidbar (nicht fünf ähnliche Gesichter).
  Bei 26–35 px Steinbreite verwechselt man leicht: Maus/Hamster/Bär, Wal/Delfin, Spatz/Ente,
  Kuchen/Torte/Muffin, Reiscracker/Reisbällchen, Donut/Bagel – lieber Bilder mit eigener Form und Farbe.
- Bonus-Gruppen erhalten automatisch einen rosa bzw. blauen Rahmen mit Eck-Band (nie gelb/orange –
  Gold ist der Tipp, Orange die Auswahl).
- Keine Marken oder bekannten Figuren.
- Der Satz erscheint automatisch im Startbildschirm (Schalter «Steine») und in den Einstellungen.
  Mehr als vier Sätze passen nicht gut in den Schalter – dann lieber einen bestehenden ersetzen.

Der Satz `klassisch` (`kind: 'drawn'`) wird in `faces.js` von Hand gezeichnet:
Bild 0–8 Punkte 1–9, 9–17 Bambus 1–9, 18–26 Zeichen 1–9, 27–30 Winde (O, S, W, N),
31–33 Drachen, 34–37 Blumen, 38–41 Jahreszeiten.

## Tische (`data/tables.js`)

Farben des Spielfelds, freigeschaltet mit den Sternen der Reise (Menü-Abschnitt «Tische»).
Eintrag: `{ id, name, stars, c1, c2, dark? }` – `stars` = nötige Sterne insgesamt (aufsteigend sortieren),
`c1`/`c2` = Verlauf oben/unten, `dark: true` für dunkle Tische (Hinweise werden dann hell gezeichnet).
Fünf Tische passen in eine Reihe; bei mehr Tischen das Raster in `style.css` (`.tables`) anpassen.

## Tagesrätsel (`daily.js`)

Seed aus dem Datum (`todayKey()`): an 7 von 10 Tagen ein Reise-Layout mit mindestens 64 Steinen,
sonst eine zufällige «Tagesform» (`generateLayoutDef` in `engine.js`). Für alle gleich, jeden Tag neu.
Neue Layouts kommen also automatisch auch ins Tagesrätsel.

## Zufallsspiel

«Zufall» im Startbildschirm: Klein / Mittel / Gross. Mischt Reise-Layouts der passenden Grösse
mit neu erzeugten Formen (`generateLayoutDef(seed, size)`, gespiegelt, mehrere Ebenen).

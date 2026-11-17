# Perlenbild – Inhalte erweitern

Perlenbild legt Pixelbilder aus glänzenden Steinen. Alle Inhalte sind reine Daten und lassen
sich ohne Änderungen an der Spiel-Engine erweitern.

| Was | Wo | Format |
| --- | --- | --- |
| Muster (Level-Bilder) | `art/tools/src/*.mjs` → gebaut nach `art/*.js` | siehe unten / `DEV.md` |
| Texte (Anleitung, Lob, Hinweise) | `data/texts.js` | einfache JS-Objekte |
| Mini-Demos der Anleitung | `howto.js` | DOM-Szenen, Positionen in % |
| Eigene Fotos der Spielerin | im Gerät (IndexedDB) | entstehen im Spiel («Eigenes Foto») |

## 1. Muster (Level)

Ein Muster ist ein Objekt im Format aus `DEV.md` («Datenformat: Perlenbild»):

```js
{
  id: 'herz', title: 'Herz', category: 'Liebe',      // id: a-z, 0-9, '-'
  palette: { k: '#7a1636', r: '#f2385a' },           // ein Zeichen pro Farbe, #rrggbb klein
  rows: [                                            // alle Zeilen gleich lang, '.' = keine Perle
    '.kk.kk.',
    'krrkrrk',
    …
  ],
}
```

Die Reihenfolge in `art/index.js` ist die **Level-Reihenfolge** (Schwierigkeit steigt). Ab Level 37
beginnt die Bibliothek von vorne (mit etwas kniffligerem Vorrat).

### Stufen (werden vom Validator geprüft)

| Level | Datei | längere Seite | Farben | Stil |
| --- | --- | --- | --- | --- |
| 1–6 | `small` | 8–12 | 2–4 | einzelnes Motiv, ohne Hintergrund |
| 7–18 | `medium` | 12–20 | 4–8 | Motiv, ohne Hintergrund |
| 19–30 | `large` | 20–28 | 6–10 | Motiv mit Hintergrund |
| 31–36+ | `showpieces` | 28–32 | 8–12 | ganze Szene |

Kategorien: `Liebe`, `Essen`, `Tiere`, `Natur`, `Dinge`, `Jahreszeiten`.

### Arbeitsablauf

1. Muster in der passenden Quelldatei `art/tools/src/<stufe>.mjs` ergänzen – entweder direkt als
   `rows: [...]` oder mit `build()` und den Zeichenhilfen aus `art/tools/raster.mjs`
   (`Grid`, `ellipse`, `poly`, `obj` = Form mit Umriss, `background`, `rimShade`, `sym`, `rles`).
   In `large.mjs`/`showpieces.mjs` bestimmt die Liste `ORDER` die Reihenfolge.
2. Bauen: `node beads/art/tools/build.mjs` (schreibt `art/small.js` … `art/showpieces.js`).
   Mit `--print <id>` wird ein Muster zusätzlich als Text ausgegeben.
3. Prüfen: `node beads/art/tools/validate.mjs --table`
   – Fehler bei: ungültigem Format, unbenutzten/fehlenden Palettenzeichen, zu ähnlichen Farben
   (ΔE2000 < 9, sonst sind die Steine im Vorrat kaum zu unterscheiden), falscher Grösse/Farbanzahl
   für die Stufe, leerem Rand, einzelnen freistehenden Perlen, «ß».
4. Anschauen: `node beads/art/tools/contact-sheet.cjs` (alle, Bilder in `art/tools/out/`) oder
   `--only id1,id2`. Nutzt den Testserver auf Port 8106 (startet ihn bei Bedarf selbst).
5. Lösbarkeit: `node --test beads/tests/` prüft u.a., dass jeder erzeugte Vorrat **ohne Helfer**
   lösbar ist und die Anzahl Züge vertretbar bleibt.

### Gestaltungstipps

- Dunkler Umriss (`k`) um Motive, ein bis zwei Glanzlichter, wenige klare Farben.
- Farben deutlich unterscheidbar wählen (hell/dunkel **und** Farbton) – die Steine im Vorrat sind klein.
- Weisse Wolken auf sehr hellem Himmel vermeiden (ΔE-Warnung) – lieber einen kräftigeren Himmel.
- Nur eigene Motive, keine bekannten Figuren oder Marken.

## 2. Texte (`data/texts.js`)

- `tutorial`: 3–4 Schritte für «So geht's» (Titel 2–4 Wörter, ein kurzer Satz). Die passende
  animierte Mini-Demo steht in `howto.js` (gleiche Reihenfolge, Liste `DEMOS`).
- `praise[sterne]`: Lob im Gewinn-Blatt; `{title}` wird durch den Bildnamen ersetzt. Pro Bild
  wird immer dieselbe Zeile gewählt.
- `hints`: kurze Meldungen im Spiel (Ablage voll, Tipp bei Festgefahren, Coach-Mark).
- Schweizer Rechtschreibung: «ss» statt «ß», Anführungszeichen «so».

## 3. Eigene Fotos

«Eigenes Foto» wandelt ein Bild aus der Fotomediathek in ein Muster um (Grösse 16/24/32 Perlen,
4–12 Farben, Farbreduktion in `photo.js`). Die Muster liegen nur auf dem Gerät (IndexedDB,
Schlüssel `beads.photo.<id>`), die Liste in `localStorage` (`spielpause.beads.photos`).

## 4. Schwierigkeit anpassen

`levelConfig()` in `level.js`: Spalten im Vorrat (`C`), Höhe der aktiven Zone (`R`),
Ablageplätze (`S`), Unordnung (`disorder`, `bury`) und Steine pro Zug (`maxChunk`, wächst mit der
Bildgrösse über `chunkMax()`). `generateTray()` verringert die Unordnung so lange, bis der Löser
eine Lösung ohne Helfer findet.

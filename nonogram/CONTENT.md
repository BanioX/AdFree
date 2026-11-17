# Bilderrätsel – Inhalte hinzufügen

Bilderrätsel sind Nonogramme: Die Zahlen am Rand verraten, wie viele Felder am Stück gefüllt sind.
Ist das Rätsel gelöst, erscheint das Pixelbild in Farbe. Alle Bilder liegen als reine Daten in
`/nonogram/data/` – zum Hinzufügen braucht es keinen Programm-Code.

## Aufbau

| Datei | Inhalt |
| --- | --- |
| `data/index.js` | Verzeichnis: Liste der **Pakete** (Reihenfolge im Menü) und der **Themen** |
| `data/mini.js` | Paket «Mini», 5 × 5 |
| `data/klein.js` | Paket «Klein», 10 × 10 |
| `data/mittel.js` | Paket «Mittel», 15 × 15 |
| `data/gross.js` | Paket «Gross», 20 × 20 |

Zusätzlich erscheinen automatisch:

- **Perlenbilder** – Muster aus `/beads/art/index.js` (falls vorhanden). Es werden nur Muster
  übernommen, die sich eindeutig per Logik lösen lassen; die anderen werden still übersprungen.
- **Endlos-Bilder** – Fantasiewesen und Mosaike, erzeugt in `core/generator.js` (5/10/15/20).
- **Tagesrätsel** – jeden Tag eines aus «Klein» (unter der Woche) bzw. «Mittel» (am Wochenende),
  für alle gleich. Jede zweite Runde durch den Vorrat wird das Bild gespiegelt.

## Ein Bild (Definition)

```js
{
  id: 'k-katze',            // eindeutig, nur a-z, 0-9 und «-». Konvention: Paket-Kürzel + Name
  title: 'Katze',           // Anzeigename (wird erst nach dem Lösen verraten)
  category: 'Tiere',        // Thema, siehe themes in data/index.js
  bg: '#fff4e0',            // optional: Hintergrundfarbe des fertigen Bildes
  palette: { o: '#f29a4a', k: '#4a3a3a', w: '#ffffff' },  // ein Zeichen pro Farbe → #rrggbb
  rows: [                   // alle Zeilen gleich lang; '.' = leeres Feld
    'o........o',
    'oo......oo',
    …
  ],
}
```

- **Jedes Zeichen ausser `.` ist ein Feld, das gefüllt werden muss** – auch Weiss! Weisse Augen
  oder Glanzlichter zählen also zum Rätsel. Was zum Hintergrund gehört, bitte als `.` lassen
  und stattdessen mit `bg` einfärben.
- Grösse: quadratisch 5, 10, 15 oder 20 – passend zum Paket.
- Jede Farbe der Palette muss im Bild vorkommen.

## Wichtig: eindeutig lösbar

Jedes Bild muss sich **ohne Raten** lösen lassen – Zeile für Zeile, Spalte für Spalte.
Das prüft ein Löser automatisch:

```sh
node nonogram/tools/check.mjs          # Bericht für alle Bilder (Exit-Code 1 bei Fehlern)
node nonogram/tools/check.mjs --show   # zeigt unklare Felder als «?»
node nonogram/tools/check.mjs --fix    # schaltet wenige, unauffällige Felder um, bis es eindeutig ist
node --test nonogram/tests/*.test.mjs  # alle Tests (inkl. Inhalte)
```

Typische Gründe für Mehrdeutigkeit: diagonale Treppen, «Schachbrett»-Ecken (zwei Felder nur
diagonal verbunden) und vereinzelte Punkte. Abhilfe: ein Feld ergänzen oder entfernen,
Konturen schliessen. `--fix` schlägt das automatisch vor und schreibt es zurück – danach das
Bild im Kontaktbogen anschauen:

```sh
node nonogram/tools/sheet.mjs nonogram/tests/out/sheet.png [paket-id]
```

## Neues Paket

1. Datei `data/<paket>.js` anlegen: `export default [ { …Bild }, … ];`
2. In `data/index.js` importieren und in `packs` eintragen:
   `{ id: 'tiere', title: 'Tierpark', subtitle: '10 × 10 · Tiere', emoji: '🦒', puzzles: tiere }`
3. `node nonogram/tools/check.mjs` ausführen.

Neue Themen in `themes` (data/index.js) ergänzen. Fertig – Menü, Paketansicht, Album und
Statistik übernehmen alles automatisch. **Bestehende `id`s nie ändern**, sonst gehen
gespeicherte Fortschritte verloren.

## Gestaltungstipps

- Klare Silhouetten mit wenigen, kräftigen Farben (2–6). Dunkle Konturfarbe hilft der Lesbarkeit.
- 5 × 5: Symbole (Herz, Stern). 10 × 10: einfache Tiere, Früchte. 15/20: Szenen mit Details.
- Nur eigene Motive – keine bekannten Figuren, Logos oder Marken.

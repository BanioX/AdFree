# Blockpuzzle – Inhalte erweitern

Alle Inhalte liegen als einfache JavaScript-Dateien in `/blocks/data/`. Es gibt keinen Build-Schritt:
Datei speichern, Seite neu laden, fertig. Nach jeder Änderung die Tests laufen lassen (siehe unten) –
sie prüfen Format, Lösbarkeit und Rechtschreibung (kein «ß»).

| Datei | Inhalt |
|---|---|
| `data/shapes.js` | Formen der Spielsteine (Polyominos) mit Häufigkeit und Grösse |
| `data/skins.js` | Aussehen (Juwelen, Pastell, Holz, Bonbon …) und die fünf Edelsteine |
| `data/pictures.js` | Versteckte Bilder für die Bild-Level (kommen ins Album) |
| `data/worlds.js` | Welten im Abenteuer (je 20 Level) |
| `data/levels.js` | Handgemachte Einstiegs-Level, Ziel-Ablauf und Schwierigkeitskurve |
| `data/words.js` | Lob-Texte beim Abräumen («Super!», «Blitzblank!» …) |

## Neue Form

In `data/shapes.js` eine Zeile ergänzen:

```js
{ id: 'haken', rows: ['##', '.#', '.#'], weight: 1.5, tier: 2, rotate: true, mirror: true, color: 3 },
```

- `rows`: `#` = Block, `.` = leer, höchstens 5×5, zusammenhängend.
- `weight`: relative Häufigkeit (wird auf alle Drehungen verteilt).
- `tier`: 0 klein … 3 gross. Am Anfang (und bei vollem Brett) kommen kleine Formen häufiger.
- `rotate` / `mirror`: Drehungen bzw. Spiegelungen automatisch erzeugen.
- `color`: Farbindex 0–7 – die echte Farbe kommt aus dem gewählten Aussehen.

Der Generator (`core/generator.js`) sorgt selbst für Fairness: meist lassen sich alle drei Teile setzen,
bei vollem Brett immer; oft ist ein Teil dabei, das sofort eine Linie füllen kann.

## Neues Aussehen

In `data/skins.js` einen Eintrag anhängen. `style` wählt den Zeichenstil der Steine:
`'jewel'` (geschliffen, glänzend), `'soft'` (weich, pastell) oder `'wood'` (Holz mit Maserung).
Es braucht genau 8 Steinfarben, die Brettfarben (`bg`, `cell`, `edge`, `cover`, `coverMark`) und `gray`
(Farbe für Teile, die gerade nicht passen). Das neue Aussehen erscheint automatisch im Menü und in der Pause.

## Neues Bild (Album)

In `data/pictures.js` hinten anhängen – zwei Formate:

```js
// Emoji-Bild (am einfachsten)
{ id: 'igel', title: 'Igel', emoji: '🦔', bg: ['#fff4e6', '#f2d3a8'] },

// Pixelbild: ein Zeichen pro Farbe, '.' = Hintergrund, alle Zeilen gleich lang
{ id: 'pilz', title: 'Pilz', bg: ['#f3fbef', '#d5efc8'],
  palette: { a: '#d8343c', b: '#ffffff', c: '#f3dcb8' },
  rows: ['..aaaa..', '.abaaba.', 'aaaaaaaa', '...cc...', '...cc...'] },
```

Die erzeugten Bild-Level verwenden die Bilder der Reihe nach; neue Bilder kommen also in späteren
Bild-Leveln dran. Bilder, die ein handgemachtes Level schon verwendet, werden dort übersprungen.

Das Bild wird in das Rechteck um die verdeckten Felder (`cover`) eingepasst: Ist z.B. nur die untere
Brett-Hälfte verdeckt, erscheint das ganze Motiv dort (nicht abgeschnitten). Beim Sieg blendet das Bild
im ganzen Rechteck ein, also auch in Ecken ausserhalb einer runden oder herzförmigen Maske.

## Neue Welt

In `data/worlds.js` anhängen (`id`, `title`, `emoji`, `color`, `tint`). Jede Welt bringt 20 neue Level.
Nach der letzten Welt geht das Abenteuer endlos weiter («Morgentau II» …).

## Level

**Handgemachte Level** (`handcrafted` in `data/levels.js`) sind die ersten Level und führen behutsam ein.
Format (siehe Kommentar in der Datei):

```js
{
  title: 'Schatzkammer',
  size: 8,                          // 8 oder 10
  board: ['........', …],           // '.' leer, '1'–'8' Stein, 'r' 'b' 'g' 'y' 'p' Stein mit Edelstein
  cover: 'all',                     // optional (Bild-Level): 'all' oder Zeilen mit 'x'
  goals: { gems: true },            // gems | picture: 'id' | lines: 6 | score: 500 (kombinierbar)
  start: ['##|##', '###', '#|#'],   // optional: die ersten drei Teile
  d: 0.2,                           // Schwierigkeit der Teile 0 … 1
}
```

**Erzeugte Level** (alles nach den handgemachten): `core/levels.js` baut sie deterministisch aus dem
Level-Nummer-Seed – für alle gleich. Steuerbar über `cycle` (Ablauf der Ziele innerhalb einer Welt)
und `curve` (Schwierigkeit von Anfang bis Level 240, Welle innerhalb der Welt, ab wann 10×10-Bretter kommen).
Jedes Level wird beim Erzeugen vom Computer-Spieler (`core/bot.js`) gelöst; die Sterne-Grenzen
(3 Sterne / 2 Sterne nach Anzahl gesetzter Teile) werden daraus berechnet.

## Lob-Texte

`data/words.js`: Listen pro Stufe (2, 3, 4+ Linien, ganzes Brett leer, Serie). Einfach Wörter ergänzen.

## Tests

```sh
node --test blocks/tests/*.test.mjs   # Logik, Generator-Fairness, alle 240 Level lösbar, Inhalte gültig
node blocks/tests/e2e.mjs             # Playwright (iPhone 13): spielt Level 1 bis zum Sieg, Neuladen, Klassisch …
```

Screenshots des E2E-Tests landen in `blocks/tests/out/` (nicht eingecheckt).

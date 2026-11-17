# Pfeilwürfel – Inhalte erweitern

Die Level des Pfeilwürfels werden **prozedural erzeugt** (`generator.js`): Level *n* sieht für alle
immer gleich aus, und es gibt unendlich viele. Was man als Inhalt pflegt, steht in
**`data/levels.js`** – dort wird festgelegt, *wie* die Level aussehen. Neue Inhalte brauchen keinen
Code, nur einen Eintrag in dieser Datei.

> Wichtig: Jede Änderung an Rampe, Spezial-Reihenfolge oder Generator verändert die betroffenen
> Level. Bereits gelöste Level behalten ihre Sterne, sehen danach aber anders aus. Neue Einträge
> deshalb möglichst **hinten anhängen**.

## 1. Kapitel-Themen (`THEMES`)

Alle 10 Level (`CHAPTER_SIZE`) beginnt ein neues Kapitel mit eigenem Papier. Nach dem letzten Thema
geht es wieder von vorn los.

```js
{ id: 'kirsche', name: 'Kirsche', light: '#fff7f8', dark: '#f0c9d0', edge: '#e9bcc5', ink: '#4f1f2a', hint: '#2f7de1' }
```

| Feld    | Bedeutung                                                                 |
|---------|---------------------------------------------------------------------------|
| `id`    | eindeutig, `a-z0-9-`                                                      |
| `name`  | Anzeigename (Levelkarte, Spiel-Titelzeile), max. 14 Zeichen               |
| `light` | Papierfarbe im Licht (hellste Seite)                                      |
| `dark`  | Papierfarbe im Schatten                                                   |
| `edge`  | Farbe der abgerundeten Würfelkante                                        |
| `ink`   | Tintenfarbe der Pfeile – muss **deutlich dunkler** sein (Test prüft Kontrast) |
| `hint`  | optional: Farbe für Tipp und abfliegende Pfeile (Standard Blau; auf blauem Papier Orange nehmen) |

## 2. Spezial-Level (`SPECIALS`)

Jedes 10. Level (`SPECIAL_EVERY`) ist ein Spezial-Level. Die Einträge kommen der Reihe nach dran
(Level 10 = erster Eintrag, 20 = zweiter, …), danach wieder von vorn.

```js
{
  id: 'kompakt', title: 'Kompakt', emoji: '📦',
  text: 'Kleiner Würfel, aber randvoll.',    // ein kurzer Satz, wird im Spiel eingeblendet
  maxN: 6, density: 0.08,
}
```

`textMax` (optional) ersetzt `text`, wenn `grow` nichts mehr bewirkt, weil der Würfel schon die
Höchstgrösse 10 hat (z.B. «Riesenwürfel» in späten Leveln).

Regler (alle optional, beliebig kombinierbar):

| Regler       | Wirkung                                                         |
|--------------|-----------------------------------------------------------------|
| `grow`       | Würfel um so viele Zellen grösser (höchstens 10)                |
| `maxN`       | Würfel höchstens so gross                                       |
| `density`    | Dichte zusätzlich (+0.05 = 5 % mehr belegte Zellen, max. 0.9)   |
| `maxDensity` | Dichte höchstens                                                |
| `hearts`     | Herzen zusätzlich (+1 / −1); das Ergebnis bleibt immer 3–5       |
| `minLen`     | kürzeste Pfeillänge in Zellen                                   |
| `maxLen`     | längste Pfeillänge zusätzlich (max. 12)                         |
| `turn`       | Abbiege-Freude 0 (fast gerade) … 1 (sehr kurvig)               |
| `maxTurns`   | höchstens so viele Kurven pro Pfeil (0 = nur gerade, über Kanten gerade weiter zählt nicht); freie Pfeile werden dann streng begrenzt |
| `mustCross`  | `true`: jeder Pfeil muss über eine Würfelkante laufen           |

Der Test `Spezial-Level halten, was ihr Text verspricht` (in `tests/content.test.mjs`) prüft
Kurven pro Pfeil, Kantenläufe und Grösse. Wer einen Spezial-Typ mit neuem Versprechen einführt,
ergänzt dort eine passende Prüfung.

## 3. Grössen-Rampe (`SIZES`, `LATE_SIZES`, `HEARTS`)

- `SIZES`: bis und mit Level `to` hat der Würfel `N × N` Zellen pro Seite (3 … 10).
- `LATE_SIZES`: danach wird pro Level (deterministisch) eine Grösse aus dieser Liste gewählt.
- `HEARTS`: Herzen je nach Würfelgrösse (immer 3–5).
- Ab Level 13 ist jedes Level mit `L % 7 === 3` eine kleine Verschnaufpause (eine Nummer kleiner).

## 4. Lob-Sätze (`PRAISE`)

Kurze Sätze für das Gewinn-Blatt, getrennt nach 1, 2 oder 3 Sternen.

## Regeln für Texte

Deutsch, **Schweizer Rechtschreibung** (kein «ß», sondern «ss»; Anführungszeichen «so»),
kurz und freundlich. Keine fremden Marken oder Figuren.

## Prüfen

```sh
node --test cube/tests/          # Format, Kontrast, Rechtschreibung, Lösbarkeit Level 1–200
node cube/tests/e2e.mjs          # Ablauf im Browser (iPhone 13), Screenshots in cube/tests/out/
```

Die Tests prüfen u. a.: gültige Farben und Kontrast, bekannte Regler, eindeutige IDs, Schweizer
Schreibweise sowie dass **jedes** Level 1–200 und jeder Spezial-Typ lösbar ist (Simulation). Die
Lösbarkeit ist durch die Rückwärts-Konstruktion des Generators garantiert: Jeder neue Pfeil wird
nur so gelegt, dass sein Weg zum Rand frei ist, wenn man die Pfeile in umgekehrter Reihenfolge
entfernt.

## Dateien im Überblick

| Datei            | Inhalt                                                        |
|------------------|---------------------------------------------------------------|
| `data/levels.js` | **Inhalte** (dieses Dokument)                                 |
| `generator.js`   | Level-Erzeugung (Rückwärts-Konstruktion), Löser               |
| `geometry.js`    | Würfeloberfläche, Nachbarn über Kanten, Strahlen              |
| `game.js`        | Spielzustand (frei/blockiert, Herzen, Sterne)                 |
| `render.js`      | Canvas-2D-Darstellung mit eigener Projektion                  |
| `play.js`        | Spielansicht, Animationen, Gesten                             |
| `menu.js`        | Startbildschirm, Levelkarte, Statistik                        |
| `howto.js`       | «So geht's» mit animierten Mini-Würfeln                       |
| `progress.js`    | Speicherstand, Statistik, Einstellungen                       |

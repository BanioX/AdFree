# Dreierlei – Inhalte ergänzen

Dreierlei erzeugt seine Level selbst (unendlich viele, per Seed immer gleich).
Die Inhalte, aus denen die Level gebaut werden, liegen in `/triple/data/`:

| Datei | Inhalt |
|---|---|
| `data/themes.js` | Themen = Bildersätze (Emoji) für die Steine, mit Farben |
| `data/shapes.js` | Grundformen = Umriss der untersten Ebene |

Nach jeder Änderung die Tests laufen lassen:

```sh
node --test triple/tests/*.test.mjs
```

Die Tests prüfen das Format, die Schweizer Schreibweise (kein «ß») und erzeugen mit jedem Thema,
jeder Form und jeder Grösse Level, die nachweislich lösbar sein müssen.

## Neues Thema

Einen Eintrag ans Ende der Liste `themes` in `data/themes.js` anhängen:

```js
{
  id: 'bauernhof',            // eindeutig, nur a-z, 0-9 und -
  title: 'Bauernhof',         // Anzeigename (Deutsch, «ss» statt «ß»)
  // short: 'Hof',            // optional: Kurzname für die schmale Titelzeile im Spiel (Pflicht, wenn
                              //   «title» länger als 15 Zeichen ist, z.B. 'Winter' für «Winter & Weihnachten»)
  color: '#c98a2e',           // Akzentfarbe (Fortschrittsbalken, Funken, Konfetti)
  bg: '#fff3dc',              // sehr helle Hintergrundfarbe der Spielfläche
  emoji: ['🐄', '🐖', '🐑', '🐓', '🐴', '🐐', '🦆', '🐇', '🚜', '🌾', '🥚', '🧀', '🥛', '🌽', '🍎', '🐕'],
},
```

Regeln:

- **Mindestens 16 verschiedene Emoji** (grosse Level brauchen bis zu 16 Sorten).
- Gut unterscheidbare Bilder wählen – keine Fast-Doppelgänger (z.B. nicht 🐱 und 😺 zusammen),
  ähnliche Farben möglichst vermeiden. Auf dem iPhone sind die Steine klein (≈ 45 px)!
  Bekannte Verwechsler stehen in `lookalikes` (unten in `data/themes.js`, z.B. 🌻/🌼, 🏈/🏉, 🍰/🎂,
  🐙/🦑): pro Thema höchstens eines je Gruppe – der Test prüft das. Fällt dir ein weiteres Paar auf,
  ergänze dort eine Gruppe.
- Ein Emoji ersetzen: **an derselben Stelle** austauschen (Anzahl gleich lassen) – dann bleiben die
  Level gleich aufgebaut und angefangene Spielstände gültig, nur das Bild wechselt.
- Keine Marken, Logos oder bekannte Figuren.
- Pro Level werden zufällig so viele Bilder gewählt, wie das Level Sorten braucht (4–16).

Das Thema erscheint sofort im «Freien Spiel» und wird in der Level-Reihe automatisch eingeplant
(erste Runde in Listen-Reihenfolge, danach gemischt, nie zweimal hintereinander dasselbe).
Hinweis: Ein neues Thema verändert die Themen-Abfolge späterer Level – angefangene Level-Spielstände
werden dann verworfen (der Fortschritt bleibt). Darum neue Themen **ans Ende** anhängen.

## Neue Form

Einen Eintrag an `shapes` in `data/shapes.js` anhängen:

```js
{
  id: 'pilz', title: 'Pilz',
  rows: [
    '.#####.',
    '#######',
    '#######',
    '..###..',
    '..###..',
  ],
},
```

- `#` = hier liegt ein Stein der untersten Ebene, `.` = leer.
- Höchstens **7 Spalten** und **8 Zeilen**, alle Zeilen gleich lang, mindestens 10 `#`.
- Möglichst symmetrisch (links/rechts) – das sieht handgemacht aus.
- Die oberen Ebenen baut der Generator selbst: je nach Stil versetzt um einen halben Stein
  (`pyramide`, `versatz`, `stufen`), als Türmchen im Schachbrett (`turm`) oder abwechselnd (`wechsel`),
  jeweils nach innen geschrumpft. Wie viele Ebenen es werden, ergibt sich aus der Steinzahl des Levels.

## Wie die Lösbarkeit garantiert wird

`logic/generator.js` baut zuerst die Ebenen und kürzt sie auf ein Vielfaches von 3.
Dann wird eine zufällige Abräum-Reihenfolge erzeugt und die Bilder werden so verteilt, dass in
dieser Reihenfolge nie mehr als 3–6 Steine gleichzeitig in der Ablage liegen (je nach Level).
Jede Sorte kommt dadurch in Dreiergruppen vor. Zum Schluss wird die Reihenfolge mit den echten
Spielregeln nachgespielt (`simulate`) – nur dann gilt das Level als bestätigt.
Der Löser (`logic/solver.js`) wird für «Tipp», «Mischen» (bleibt lösbar) und die Tests verwendet.

## Schwierigkeit der Level-Reihe

`levelParams(n)` in `logic/generator.js`: Steinzahl, Ebenen, Anzahl Sorten und «cap»
(wie voll die Ablage auf dem Lösungsweg höchstens wird – kleiner = leichter).
Jedes 5. Level ist eine «Verschnaufpause» (kleiner), jedes 10. ein «Grosses Level».

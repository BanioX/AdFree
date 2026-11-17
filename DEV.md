# Spielpause – Entwickler-Leitfaden

Spielpause ist eine werbefreie Web-App (PWA) mit drei Spielen für das iPhone.
Sie wird über GitHub Pages ausgeliefert und per Safari → «Zum Home-Bildschirm» installiert.
Ziel: fühlt sich an wie eine liebevoll gemachte native App. Ruhig, hochwertig, befriedigend.

Die Startseite (`/index.html`) ist ein **Spielkatalog** (4 Kacheln pro Reihe). Alle Spiele stehen
im Verzeichnis **`/games.js`** (id, Titel, Kategorie, Farbe, Tagesrätsel ja/nein). Jedes Spiel lebt
in seinem eigenen Ordner `/<id>/` und hat ein Kachel-Icon `/icons/games/<id>.svg`.

**Ein neues Spiel hinzufügen:** Ordner `/<id>/` anlegen, Icon zeichnen, Eintrag in `/games.js` – fertig.

Aktuelle Spiele: siehe `/games.js` (Farbenzauber, Perlenbild, Pfeilwürfel, Solitär, Mahjong, Dreierlei,
Sudoku, Bilderrätsel, Farbfluss, Blockpuzzle, Verdoppeln, Wortsuche, Wortrate, Juwelen, Blasenzauber, Puzzle).

Wichtig: Das sind **eigene** Spiele mit ähnlicher Mechanik wie bekannte Apps – keine Kopien.
Keine fremden Namen, Figuren, Marken (kein Marvel, Disney, Pokémon, …), kein nachgebautes Aussehen.

## Technik-Regeln (für alle)

- **Vanilla JavaScript (ES-Module), HTML, CSS. Kein Build-Schritt, keine Frameworks, keine CDNs,
  keine externen Dateien.** Alles muss offline funktionieren.
- Ziel-Gerät: **iPhone, Safari (iOS 17+), Hochformat**, 375–430 CSS-px breit, devicePixelRatio 3.
  Auch im Desktop-Browser benutzbar (Maus + Mausrad-Zoom wo sinnvoll).
- Eingabe über **Pointer Events** (`pointerdown/move/up/cancel`), `touch-action: none` auf Spielflächen.
- Canvas immer mit `devicePixelRatio` skalieren (Deckel bei ~2.5–3, Speicher beachten).
  Auf `resize`/Orientierungswechsel reagieren.
- Safe Areas beachten (`env(safe-area-inset-*)`, Variablen `--safe-top` etc. in `shared/style.css`).
  Kein `100vh` – `100dvh` oder `position: fixed; inset: 0` (siehe `.app`).
- 60 fps anstreben. Nur neu zeichnen, wenn sich etwas ändert (requestAnimationFrame-Loop, der schläft).
- Sprache der Oberfläche: **Deutsch, Schweizer Rechtschreibung** (kein «ß», sondern «ss»;
  Anführungszeichen «so»). Kurze, freundliche Texte.
- Spielstand wird automatisch gespeichert (beim Verlassen nichts verloren). Kein Login, nichts online.
- **Keine Werbung, keine Käufe, keine künstlichen Wartezeiten, keine Energie-/Leben-Paywalls.**
  Hilfen (Tipps, Mischen, …) sind gratis.
- Jede Datei, die du anlegst, gehört in **deinen** Ordner (plus dein Icon `/icons/games/<id>.svg`).
  Ändere keine Dateien ausserhalb deines Bereichs (insbesondere nicht `/shared/*`, `/index.html`,
  `/games.js`, `/sw.js`). Wenn dir in `shared` etwas fehlt, baue es lokal in deinem Ordner.
- Laufzeit-Code nicht in Ordner namens `tests`, `tools` oder `src` legen – diese werden beim
  Veröffentlichen weggelassen (dort gehören Tests, Werkzeuge und Quellskripte hin).
- **Keine git-Befehle, die etwas verändern** (kein commit/add/checkout/stash/reset). Der Orchestrator committet.

## Gemeinsame Module (`/shared/`)

```js
import { store, reportSummary } from '../shared/storage.js'; // localStorage (JSON), Präfix "spielpause."
import { kv } from '../shared/idb.js';                        // IndexedDB key-value (grosse Daten), async
import { makeRng, hashString } from '../shared/rng.js';       // deterministischer Zufall
import { sfx } from '../shared/sfx.js';                       // sfx.play('tap'|'pop'|'fill'|'place'|'whoosh'|'error'|'complete'|'sparkle'|'click'|'thud')
import { icon, h, toast, showModal, confirmDialog, celebrate, setupPage,
         soundButton, backButton, sleep, ease } from '../shared/ui.js';
```

- `setupPage()` – einmal pro Seite aufrufen: verhindert iOS-Zoom/Doppeltipp, registriert Service Worker.
- `icon(name, {size})` – SVG-String. Namen: back, close, home, settings, hint, soundOn, soundOff,
  refresh, undo, plus, check, star, heart, image, camera, bolt, shuffle, play, pause, trash,
  zoomIn, zoomOut, expand, share, download, lock, grid, rotate, sparkle, more.
- `showModal({title, text|html|content, buttons:[{label, value, primary, ghost, icon}]})` → Promise(value).
- `celebrate(colors?)` – Konfetti. `toast(text)` – kurze Meldung.
- `reportSummary('<id>', 'Level 7')` – kurzer Status-Text (wird im Info-Blatt der Kachel gezeigt).
- Tagesrätsel (nur Spiele mit `daily: true` in `/games.js`): Route `#daily` startet das Rätsel des Tages,
  Seed aus `todayKey()` (z.B. `makeRng('sudoku-' + todayKey())`) – für alle gleich, jeden Tag neu.
  Nach dem Lösen `markDailyDone('<id>')`. Helfer: `todayKey, markDailyDone, isDailyDone, dailyStreak`
  aus `/shared/storage.js`. Im Spielmenü sichtbar anbieten («Tagesrätsel» mit Häkchen wenn gelöst).
- CSS-Klassen: `.app`, `.topbar`, `.title`, `.icon-btn`, `.btn`, `.btn.primary`, `.chip`, `.card`,
  `.scroll`, `.sp-shake`, `.sp-pop`, Variablen `--accent`, `--surface`, `--text-2`, … (siehe `shared/style.css`).
  Jedes Spiel darf `--accent` für sich überschreiben: Farbenzauber `#ff6f7d`, Pfeilwürfel `#f29a1f`, Perlenbild `#3f8ef0`.

## Kachel-Icon (`/icons/games/<id>.svg`)

- `viewBox="0 0 100 100"`, vollflächiger Hintergrund (sanfter Verlauf in der Spielfarbe, hell),
  ein klares, freundliches Motiv in der Mitte, **kein Text**, keine feinen Details (wird ~80 px gross gezeigt).
  Die Startseite rundet die Ecken selbst ab. Stil wie `/icons/games/paint.svg`, `cube.svg`, `beads.svg`:
  flach, dunkelbraune Konturen (#3a2a2a / #4a3418) oder konturlos mit weichen Glanzlichtern.

## Seitengerüst eines Spiels

```html
<!doctype html>
<html lang="de-CH">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
  <title>Farbenzauber – Spielpause</title>
  <meta name="theme-color" content="#fbf6ef">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="Spielpause">
  <link rel="manifest" href="../manifest.webmanifest">
  <link rel="apple-touch-icon" href="../icons/apple-touch-icon.png">
  <link rel="stylesheet" href="../shared/style.css">
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <div class="app" id="app"></div>
  <script type="module" src="app.js"></script>
</body>
</html>
```

Der Zurück-Button oben links führt aus dem Spiel-Menü zur Startseite (`../`), aus einem laufenden
Level zurück ins Spiel-Menü. Jedes Spiel hat ein eigenes kleines Menü (Startbildschirm) mit grossem
«Spielen»/«Weiter»-Button, ggf. Modus/Schwierigkeit, Tagesrätsel, Statistik und einer kurzen
Anleitung («So geht's», beim ersten Start automatisch). Innerhalb eines Spiels kann man Hash-Routing (`#play/rose`) verwenden,
damit der Zustand beim Neuladen erhalten bleibt.

## Testen

- Statischer Server aus dem Repo-Wurzelverzeichnis: `python3 -m http.server <PORT> --bind 127.0.0.1`
  (jede Teilaufgabe hat ihren eigenen Port, siehe Auftrag). Im Hintergrund starten.
- Playwright ist vorinstalliert. In CommonJS `require('playwright')`; in ES-Modulen (.mjs) funktioniert der
  nackte Import NICHT – stattdessen `import { createRequire } from 'node:module';
  const { chromium, devices } = createRequire(import.meta.url)('playwright');`.
  `chromium.launch()` braucht keine Optionen. Gerät: `devices['iPhone 13']` (hasTouch, isMobile).
  Taps mit `page.touchscreen.tap(x, y)` oder `locator.tap()`; Pinch/Drag über
  CDP `Input.dispatchTouchEvent` oder per synthetischen PointerEvents.
- **Screenshots anschauen** (PNG mit dem Read-Tool öffnen) und das Aussehen kritisch beurteilen.
- Reine Logik (Generatoren, Löser, Geometrie) als `node --test` Tests in `/<spiel>/tests/`.
- Konsolenfehler prüfen (`page.on('console')`, `page.on('pageerror')`) – es dürfen keine auftreten.
- Service Worker wird lokal nur mit `?sw=1` registriert – normal also kein Cache-Ärger.
- Emoji dürfen als Bildinhalte verwendet werden (auf dem iPhone sehr schön). Hier im Test-Chromium
  ist «Noto Color Emoji» installiert – sieht anders aus, aber funktioniert.

---

## Datenformat: Farbenzauber (Malen nach Zahlen)

Ein Bild (`Puzzle`) ist ein reines JS-Objekt (JSON-kompatibel):

```js
{
  id: 'rose',                 // eindeutig, [a-z0-9-]
  title: 'Rose',              // deutscher Anzeigename
  category: 'Blumen',         // 'Blumen' | 'Tiere' | 'Landschaften' | 'Essen' | 'Fantasie' | 'Mandalas' | 'Muster' | 'Meine Fotos' | …
  width: 1000, height: 1000,  // Koordinatenraum wie SVG-viewBox "0 0 width height" (empfohlen 1000×1000 oder 800×1000)
  palette: ['#f6c1cc', '#e0466a', '#2f8f5b'],  // Farbe i wird als Nummer i+1 angezeigt (max. 30 Farben)
  shapes: [                   // Maler-Reihenfolge: spätere Formen liegen OBEN
    { d: 'M0 0H1000V1000H0Z', c: 0 },         // SVG-Pfaddaten (alle Befehle erlaubt), c = Palettenindex
    { d: 'M500 200C…Z', c: 1, r: 'evenodd' }, // r optional: Füllregel 'evenodd' (Standard 'nonzero')
  ],
  lines: [ { d: 'M…', w: 4, color: '#2b2420' } ],  // optional: Deko-Linien, immer oben, nicht ausmalbar (sparsam!)
  background: '#ffffff',      // optional, Standard weiss
}
```

- **Jede Form ist genau ein antippbarer Bereich.** Ihr sichtbarer Teil = ihre Fläche minus alles, was später darüber gezeichnet wird.
- Die ganze Bildfläche sollte von Formen bedeckt sein (z.B. erste Form = Hintergrund-Rechteck, auch ausmalbar).
- Benachbarte Formen gleicher Farbe werden **nicht** zusammengelegt – also lieber eine grössere Form zeichnen.
- Die Engine berechnet selbst, wo die Nummer steht (Punkt mit grösstem Abstand zum Rand des sichtbaren Teils)
  und wie gross sie ist. Formen mit winzigem sichtbarem Teil werden automatisch vorausgefüllt.

### Module und Zuständigkeiten

- `/paint/art/index.js` (Bild-Bibliothek, handgezeichnete Vektorbilder):
  ```js
  export const pictures = [
    { id: 'rose', title: 'Rose', category: 'Blumen', load: () => import('./rose.js').then((m) => m.default) },
    …
  ];
  ```
  Jede Bilddatei `export default { …Puzzle }`. Zwei Künstler-Teams arbeiten parallel:
  Team A legt seine Bilder in `/paint/art/a/`, Team B in `/paint/art/b/`, jeweils mit eigener
  `index.js` (`export const pictures = [...]`). `/paint/art/index.js` fasst beide zusammen (gehört der Engine).
- `/paint/gen/index.js` (Generatoren + Foto-Umwandlung):
  ```js
  export const generators = [
    { id: 'mandala', title: 'Mandala', category: 'Mandalas', make: (seed) => Puzzle },   // deterministisch
    …
  ];
  export async function photoToPuzzle(source /* File | Blob | ImageBitmap | HTMLImageElement */, {
    colors = 16,            // 6..30
    detail = 'mittel',      // 'grob' | 'mittel' | 'fein'
    onProgress,             // (0..1) => void
    signal,                 // AbortSignal
  } = {}) { return Puzzle; } // id/title/category setzt der Aufrufer bei Bedarf
  ```
- Alles andere in `/paint/` (Galerie, Mal-Ansicht, Rendering, Speichern) gehört der **Engine**.

## Datenformat: Perlenbild (Pixel-Muster)

```js
// /beads/art/index.js
export const patterns = [
  {
    id: 'heart', title: 'Herz', category: 'Liebe',
    palette: { a: '#c2185b', b: '#ff5c8a', c: '#ffffff' },  // ein Zeichen pro Farbe (a-z, A-Z, 0-9)
    rows: [                                                  // alle Zeilen gleich lang; '.' = leer (keine Perle)
      '.aa...aa.',
      'abba.abba',
      …
    ],
  },
  …
];   // Reihenfolge = Schwierigkeit aufsteigend (Grösse, Anzahl Farben)
```

Alles andere in `/beads/` gehört der **Perlenbild-Engine**.

## Pfeilwürfel

Vollständig in `/cube/` (Level werden prozedural erzeugt), siehe Auftrag.

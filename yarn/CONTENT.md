# Wollknäuel – Inhalte ergänzen

Die Level werden aus einem Seed erzeugt und vom Löser geprüft (`/lib/sorting/generator.js`,
`/lib/sorting/solver.js`) – sie sind darum immer lösbar, auf allen Geräten gleich und gehen nie aus.

Regeln: Alle obersten Schlaufen gleicher Farbe wandern zusammen (so viele Platz haben). **Eigene
Wendung:** Eine volle, einfarbige Spule wird sofort verstrickt – das Strickstück fliegt in den
Strickkorb und die Spule ist wieder frei. Darum reicht meist eine einzige leere Spule.

## Dateien

| Datei | Inhalt |
|-------|--------|
| `data/levels.js` | Kapitel (Name, Emoji, Hintergrund), Schwierigkeitskurve `levelParams(n)`, Modi `zenParams`, `hardParams`, `dailyParams` |
| `data/colors.js` | Wollfarben (Grundton `c`, Schatten `d`, Licht `l`, deutscher Name) |
| `data/items.js` | Strickstücke für den Strickkorb (Form als SVG-Pfad, Freischalt-Schwelle) |
| `app.js` | Aussehen (Spule, Schlaufe), Strick-Animation, Strickkorb, Klänge, Tutorial |
| `style.css` | Holz, Wollstruktur, Korb-Anzeige |

## Level-Parameter

```js
{ colors: 6, cap: 4, empties: 1, fill: 'full', minMoves: 12, maxMoves: 30, maxTries: 40, tag: 'Dicke Spulen' }
```

- `colors` – Anzahl Farben (höchstens 12), `cap` – Schlaufen pro Spule (3–5)
- `empties` – leere Spulen am Anfang (0 nur zusammen mit `fill: 'loose'`)
- `fill` – `'full'` oder `'loose'` (ungleich bewickelt, eine Spule mehr – «Wirrwarr»)
- `minMoves` / `maxMoves` – gewünschte Lösungslänge, `maxTries` – Anzahl geprüfter Mischungen
- `tag` – kurzer Hinweis in der Kopfzeile

## Neues Strickstück

In `data/items.js` einen Eintrag anhängen (Raster 0 0 48 48, `at` grösser als beim Vorgänger):

```js
{ id: 'stulpe', name: 'Stulpe', at: 90,
  body: 'M14 6h20v36H14z',            // Hauptform: Wollfarbe + Strickmuster
  trim: 'M14 6h20v5H14zM14 37h20v5H14z', // optional: Bündchen, Bommel (heller)
  lines: 'M24 11v26' },               // optional: Ziernähte
```

Jede fertige Spule ergibt ein Stück; die Art geht reihum durch alle bis dahin freigeschalteten Stücke
(`itemFor(n)`). Neue Stücke erscheinen im Menü zuerst als graue Silhouette mit «ab N Stück».

## Neues Kapitel / neue Farbe

- Kapitel: in `CHAPTERS` `{ name, emoji, bg: [hell, dunkler] }` anhängen.
- Farbe: in `data/colors.js` anhängen (gut unterscheidbar) und `MAX_COLORS` in `data/levels.js` erhöhen.

## Prüfen

```bash
node --test yarn/tests/*.test.mjs lib/sorting/tests/*.test.mjs
python3 -m http.server 8306 --bind 127.0.0.1 &      # aus dem Repo-Wurzelverzeichnis
node yarn/tests/e2e.mjs
```

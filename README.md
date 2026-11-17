# Spielpause

Drei entspannte Spiele – **ganz ohne Werbung, ohne Käufe, ohne Konto**.
Läuft als Web-App direkt im iPhone-Safari und lässt sich wie eine normale App auf den
Home-Bildschirm legen. Funktioniert danach auch offline.

| Spiel | Worum es geht |
|---|---|
| 🎨 **Farbenzauber** | Malen nach Zahlen: Farbe wählen, nummerierte Flächen antippen. Handgezeichnete Bilder, endlose Mandalas, Buntglas und Low-Poly-Landschaften – und eigene Fotos werden zur Malvorlage. |
| 🧊 **Pfeilwürfel** | Ein 3D-Würfel voller Pfeile. Würfel drehen, Pfeile antippen, deren Weg frei ist – sie gleiten hinaus. Unendlich viele Level. |
| 💎 **Perlenbild** | Glitzernde Steine aus dem Vorrat sortieren und damit Reihe für Reihe ein Pixelbild legen. Auch aus eigenen Fotos. |

## Auf dem iPhone installieren

1. In **Safari** die Adresse der App öffnen (z.B. `https://adfree.<konto>.workers.dev`).
2. Unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben) tippen.
3. **«Zum Home-Bildschirm»** wählen → **Hinzufügen**.

Fertig – «Spielpause» liegt jetzt als App auf dem Home-Bildschirm. Der Spielstand wird
automatisch auf dem Gerät gespeichert.

> Wichtig: Spielstände liegen nur auf dem jeweiligen Gerät. Wer die Website-Daten von
> Safari löscht, löscht auch die Spielstände.

## Veröffentlichen

Die App ist eine reine statische Website – sie läuft auf **Cloudflare Pages** oder **GitHub Pages**.

### Cloudflare (empfohlen)

Cloudflare Dashboard → **Workers & Pages** → **Create** → Repository **BanioX/AdFree** verbinden:

| Feld | Wert |
|---|---|
| Project name | `adfree` (muss zu `name` in `wrangler.jsonc` passen) |
| Build command | leer lassen (oder `node tools/build-site.mjs`) |
| Deploy command | `npx wrangler deploy` |
| Production branch | `main` |

`wrangler.jsonc` baut die App bei jedem Deploy automatisch nach `dist/` und liefert sie von dort aus.
Die App ist danach unter `https://adfree.<dein-konto>.workers.dev` erreichbar; jeder Push
veröffentlicht automatisch eine neue Version.

(Klassisches **Cloudflare Pages** geht auch: Build command `node tools/build-site.mjs`,
Build output directory `dist`.)

### GitHub Pages (Alternative)

GitHub → Repository **AdFree** → **Settings** → **Pages** → bei *Source* **«GitHub Actions»** wählen.
Der Workflow `.github/workflows/pages.yml` veröffentlicht dann jeden Push auf `main`.

## Für Entwickler

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten.
Lokal starten:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Aufbau, Regeln und Datenformate stehen in [`DEV.md`](DEV.md).
Werkzeuge: `node tools/build-site.mjs` (baut `dist/` zum Veröffentlichen), `node tools/make-icons.mjs` (App-Icons).

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

1. In **Safari** die Adresse öffnen: **https://baniox.github.io/AdFree/**
2. Unten auf das Teilen-Symbol (Quadrat mit Pfeil nach oben) tippen.
3. **«Zum Home-Bildschirm»** wählen → **Hinzufügen**.

Fertig – «Spielpause» liegt jetzt als App auf dem Home-Bildschirm. Der Spielstand wird
automatisch auf dem Gerät gespeichert.

> Wichtig: Spielstände liegen nur auf dem jeweiligen Gerät. Wer die Website-Daten von
> Safari löscht, löscht auch die Spielstände.

## Veröffentlichen (einmalig einrichten)

Die App wird automatisch über **GitHub Pages** veröffentlicht, sobald Änderungen auf `main` landen.
Einmalig muss Pages eingeschaltet werden:

GitHub → Repository **AdFree** → **Settings** → **Pages** → bei *Source* **«GitHub Actions»** wählen.

Danach baut der Workflow `.github/workflows/pages.yml` bei jedem Push auf `main` die Seite neu.

## Für Entwickler

Reines HTML/CSS/JavaScript ohne Build-Schritt und ohne Abhängigkeiten.
Lokal starten:

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
```

Aufbau, Regeln und Datenformate stehen in [`DEV.md`](DEV.md).
Werkzeuge: `node tools/make-icons.mjs` (App-Icons), `node tools/build-sw.mjs` (Offline-Cache-Liste).

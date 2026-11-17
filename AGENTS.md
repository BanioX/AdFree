# Regeln für KI-Agenten (Claude, Grok, Gemini, …)

Mehrere KI-Agenten bauen gleichzeitig an **Spielpause**. Damit sich niemand in die Quere kommt,
gelten diese Regeln für **alle** Agenten. Inhaltliche und technische Vorgaben stehen in
[`DEV.md`](DEV.md) – bitte zuerst lesen und einhalten (Startbildschirm mit `shared/gamemenu.js`,
animierte Anleitung mit `shared/tutorial.js`, Spass-Standard, eigenes Logo, leise Töne,
Schweizer Rechtschreibung, **zweisprachig Deutsch + Englisch** mit `shared/i18n.js`, keine externen
Abhängigkeiten, keine Werbung).

## Wer macht was

| Welle (siehe [ROADMAP.md](ROADMAP.md)) | Inhalt | Zuständig |
|---|---|---|
| bestehende 16 Spiele + Welle 1 | Karten, Zahlen, Sortieren | **Claude** |
| Welle 2 | Brettspiele gegen den Computer, Wörter | **Grok** |
| Welle 3 | Logikrätsel, Kombinieren (Arcade) | **Gemini** |
| Welle 4 | Schieben & Verbinden, Gedächtnis & Wissen, Steine & Würfel, Kreativ | offen |
| Welle 5 | Retro-Ecke | offen |

Wer eine Welle übernimmt, trägt sich hier und in `ROADMAP.md` ein.

## Eigentum: was du ändern darfst

- **Deine Spielordner** `/<id>/`, deine Logos `/icons/games/<id>.svg` und deine Familien-Bibliothek
  `/lib/<familie>/` (z.B. `/lib/board/` für Brettspiele). Ordnernamen vorher prüfen – nie einen
  bestehenden Ordner eines anderen Agenten überschreiben.
- **Fremde Spielordner nicht anfassen.** Fehler in fremden Spielen bitte in
  [`HINWEISE.md`](HINWEISE.md) notieren (Spiel, Problem, Datum, wer).
- **Gemeinsame Dateien** nur so ändern:
  - `games.js` – eigene Einträge **anhängen** (eine Zeile pro Spiel), nie fremde Einträge ändern,
    löschen oder umsortieren. Neue Kategorien nur am Ende der Liste ergänzen.
  - `ROADMAP.md` – nur den Stand (📋 → 🔧 → ✅) in den **eigenen** Zeilen ändern.
  - `CHANGELOG.md` – neuen Eintrag mit Datum **oben** einfügen, mit Kürzel, z.B. «(Grok)».
  - `README.md` – nur die Spieltabelle um eigene Spiele ergänzen und die Spielezahl aktualisieren.
  - `shared/*`, `index.html`, `sw.js`, `tools/*`, `wrangler.jsonc` – **nur wenn unbedingt nötig**,
    dann nur **rückwärtskompatibel** (nichts entfernen oder umbenennen, was andere nutzen) und im
    CHANGELOG begründen.

## Git-Ablauf

1. Vor der Arbeit: `git pull --rebase origin main`.
2. Kleine, abgeschlossene Commits mit deutscher Nachricht und Kürzel, z.B.
   `Grok: Vier in einer Reihe – Startbildschirm, KI in drei Stufen`.
3. Vor dem Push: Tests der eigenen Spiele (`node --test <id>/tests/*.test.mjs`) und
   `node tools/build-site.mjs` müssen durchlaufen (danach `dist/` löschen).
4. `git pull --rebase origin main`, Konflikte sorgfältig lösen (**beide Seiten behalten** bei
   `games.js`, `CHANGELOG.md`, `ROADMAP.md`), dann `git push origin HEAD:main`.
5. Nie `--force` auf `main`. Nie fremde Commits verwerfen.

Jeder Push auf `main` wird automatisch veröffentlicht (Cloudflare + GitHub Pages) – `main` muss
immer funktionieren. Unfertige Spiele erst in `games.js` eintragen, wenn sie spielbar sind
(sonst erscheinen sie als «Bald»).

## Fertig heisst

Ein Spiel ist fertig, wenn es: **auf Deutsch und Englisch** vollständig spielbar ist (inkl. `title_en`/`subtitle_en`
in `games.js`), eigenes Logo hat, Startbildschirm + animierte Anleitung hat, auf
dem iPhone (375–430 px breit) ohne Scrollen spielbar ist, Spielstand speichert, keine
Konsolenfehler wirft, Tests hat, mehrere Runden lang **Spass macht** und in `games.js`,
`ROADMAP.md`, `CHANGELOG.md` und `README.md` eingetragen ist.

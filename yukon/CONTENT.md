# Yukon – Inhalte ergänzen

Yukon braucht keine handgemachten Level: jede Austeilung wird aus einem Seed erzeugt und vom
Löser geprüft. Darum gehen die Spiele nie aus – und jedes ist **garantiert lösbar**.

## Wie eine Austeilung entsteht

- Schlüssel: `<variante>|<spielnummer>` (z.B. `klassisch|12`) oder `daily|<JJJJ-MM-TT>` fürs Tagesspiel.
- `logic/deals.js → findDeal(key, mode)` probiert die Seeds `yukon|<key>|0`, `…|1`, … durch, bis der
  Löser (`logic/solver.js`, Bestensuche) einen Weg zum Sieg findet. Das ist deterministisch:
  gleicher Schlüssel = gleiche Austeilung auf jedem Gerät.
- Gespeichert wird nur der gefundene Seed und die gespielten Züge (`yukon.save.<slot>`).

## Varianten (`data/config.js`)

```js
export const MODES = [
  { id: 'klassisch', label: 'Klassisch', sub: 'Rot auf Schwarz', suit: false },
  { id: 'russisch', label: 'Russisch', sub: 'Gleiche Farbe · knifflig', suit: true },
];
```

- Neue Variante: Eintrag ergänzen. `suit: true` heisst «nur in gleicher Farbe bauen».
  Wer eine ganz neue Regel will (z.B. andere Austeilung), erweitert `logic/rules.js`
  (`dealDeck`, `fits`) und ergänzt Tests.
- `DAILY_MODE`: Variante des Tagesspiels.
- `GEN_NODES` / `GEN_TRIES`: Suchbudget beim Prüfen. Höher = auch schwierigere Austeilungen,
  aber langsamerer Start. Klassisch braucht im Schnitt ~2 Versuche, Russisch ~14 (je wenige ms).

## Kartenrücken und Tische

Gemeinsam für alle Kartenspiele in `/lib/cards/backs.js` und `/lib/cards/tables.js`
(siehe `/lib/cards/README.md`).

## Prüfen

```sh
node --test yukon/tests/*.test.mjs          # Regeln, Löser, 60 Austeilungen lösbar
python3 -m http.server 8302 --bind 127.0.0.1  # im Repo-Wurzelverzeichnis
node yukon/tests/e2e.mjs                      # ganzer Ablauf im iPhone-Browser
```

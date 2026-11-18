# Sternkater – Bosse ergänzen

Bosse in `data/bosses.js`. Der Held steht links, der Boss rechts (`x` gross, `hw` als halbe Breite).
`platforms` sind Flächen, `floor: true` ist der Boden. Ein Sprung schafft etwa 50 Pixel Höhe.

`coreByPhase` setzt die Höhe des Kerns pro Stufe, passend zu den Schuss-Höhen
(Füsse der Fläche minus 9). `shock` trifft nur, wer auf `y` am Boden steht.
Schritte: `shock`, `arc`, `bar`, `laser`, `drop`, `home`.

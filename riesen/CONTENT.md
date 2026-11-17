# Riesenjagd – Bosse ergänzen

Die Bosse stehen in `data/bosses.js`. Jeder Boss hat `id`, `name`, `pal`
(`magenta`, `cyan`, `purple`, `green`, `teal`), `kind` (Silhouette) und `phases`.

Eine Phase hat `until` (Leben-Anteil, unter dem die nächste Phase beginnt) und `steps`.
Jeder Schritt braucht `kind` und `dur` (Sekunden). Gefährliche Schritte brauchen `warn`,
kürzer als `dur`, mindestens 0.28 Sekunden: erst die Anzeige, dann der Schaden.

Schritte: `wait`, `laser`, `focus`, `bar`, `cannon`, `ring`, `home`, `curtain`, `drop`.
`core` ist der helle Kern (mehr Schaden). `coreClosedDuring` schliesst ihn während der
genannten Schrittarten.

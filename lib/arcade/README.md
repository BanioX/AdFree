# Arcade

`loop.js` liefert `frameLoop(fn)`. `fn` bekommt `dt` in Millisekunden, gedeckelt auf 32, damit die Spiele flüssig bei 60 Bildern bleiben und ein Hänger keinen grossen Sprung macht.

Die Regeln jedes Spiels liegen im eigenen Ordner. Die Hülle (Menü, Sprache, Gewinn) kommt aus `lib/board/kit.js`.

// Lob-Texte, die beim Abräumen gross über dem Brett erscheinen.
// Pro Stufe eine Liste – es wird zufällig eine gewählt. Einfach Wörter ergänzen.

export const praise = {
  2: ['Super!', 'Toll!', 'Klasse!', 'Prima!'],          // zwei Linien auf einmal
  3: ['Fantastisch!', 'Grossartig!', 'Wunderbar!'],     // drei Linien
  4: ['Unglaublich!', 'Sensationell!', 'Meisterhaft!'], // vier oder mehr
  perfect: ['Blitzblank!', 'Alles leer!'],              // ganzes Brett leer geräumt
  streak: ['Serie', 'Weiter so!', 'Im Fluss!'],          // erster Eintrag + Zahl (z.B. «Serie ×3»)
};

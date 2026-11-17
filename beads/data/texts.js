// Perlenbild – Texte (Anleitung, Lob, Hinweise). Reine Daten, siehe /beads/CONTENT.md.
// Schweizer Rechtschreibung: «ss» statt «ß», Anführungszeichen «so».

/** «So geht's»: 4 Schritte (Titel 2–4 Wörter, ein kurzer Satz). Die Mini-Demos stehen in howto.js. */
export const tutorial = [
  { title: 'Spalte antippen', text: 'Die vordersten Steine gleicher Farbe fliegen ins Bild.' },
  { title: 'Von unten nach oben', text: 'Das Bild wächst Zeile für Zeile. Die leuchtende Zone zeigt, was gerade gebraucht wird.' },
  { title: 'Die Ablage', text: 'Passt eine Farbe noch nicht, wartet sie in der Ablage und springt später von selbst ins Bild.' },
  { title: 'Helfer sind gratis', text: 'Magnet, Mischen und +1 Ablage – so oft du willst. Ganz ohne Helfer gibt es 3 Sterne.' },
];

/** Lob im Gewinn-Blatt, je nach Sternen. {title} = Bildname. Eine Zeile wird zufällig (aber fest pro Bild) gewählt. */
export const praise = {
  3: [
    '«{title}» ist fertig – ganz ohne Helfer. Wunderbar!',
    'Perfekt gelegt! «{title}» glänzt in voller Pracht.',
    'Ohne Helfer geschafft – «{title}» ist ein kleines Kunstwerk.',
    'Bravo! Jeder Stein sitzt: «{title}» ist fertig.',
  ],
  2: [
    '«{title}» ist fertig – mit ein wenig Hilfe. Sehr schön!',
    'Schön gelegt! «{title}» hat seinen Platz in der Sammlung.',
  ],
  1: [
    '«{title}» ist fertig. Gut gemacht!',
    'Geschafft! «{title}» wartet in deiner Sammlung.',
  ],
};

/** Kleine Hinweise im Spiel. */
export const hints = {
  stuck: 'Kleiner Tipp: Nutze einen Helfer',
  full: 'Ablage voll',
  maxSlots: 'Mehr Ablageplätze passen nicht hin',
  coach: 'Tippe auf diese Spalte',
};

/** Untertitel im Startbildschirm. */
export const tagline = 'Steine sortieren, Bild legen';

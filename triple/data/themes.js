// Dreierlei – Themen (Bildersätze für die Steine).
//
// Jedes Level gehört zu einem Thema. Pro Level werden daraus so viele Bilder gewählt,
// wie das Level verschiedene Steinsorten braucht (4 bis 16). Mehr Bilder = mehr Abwechslung.
//
// Felder:
//   id     eindeutig, nur a-z0-9-
//   title  Anzeigename (Deutsch, Schweizer Schreibweise)
//   color  Akzentfarbe des Themas (Fortschrittsbalken, Funken)
//   bg     zarte Hintergrundfarbe der Spielfläche (sehr hell!)
//   emoji  mindestens 16 verschiedene Emoji, gut unterscheidbar (keine Fast-Doppelgänger)
//
// Neues Thema: einfach einen Eintrag ans Ende anhängen – fertig (siehe CONTENT.md).

export const themes = [
  {
    id: 'obst', title: 'Obst', color: '#e2525c', bg: '#ffe9e4',
    emoji: ['🍓', '🍒', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🫐', '🍍', '🥝', '🍑', '🥭', '🍈', '🥥', '🍅'],
  },
  {
    id: 'blumen', title: 'Blumen', color: '#e2699a', bg: '#ffe8f1',
    emoji: ['🌸', '🌷', '🌹', '🌺', '🌻', '🌼', '💐', '🪷', '🪻', '🥀', '🍀', '🌿', '🌱', '🍃', '🌾', '🪴', '💮'],
  },
  {
    id: 'tiere', title: 'Tiere', color: '#d08a3c', bg: '#fff0dc',
    emoji: ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦉', '🦄'],
  },
  {
    id: 'suesses', title: 'Süsses', color: '#d9709e', bg: '#ffeaf3',
    emoji: ['🍰', '🧁', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍯', '🍦', '🍨', '🍧', '🎂', '🥧', '🧇', '🥞', '🍡', '🥮'],
  },
  {
    id: 'meer', title: 'Meer', color: '#2f8fd0', bg: '#e3f3ff',
    emoji: ['🐠', '🐟', '🐡', '🐬', '🐳', '🦈', '🐙', '🦑', '🦀', '🦞', '🦐', '🐚', '🪸', '🐢', '🦭', '🪼', '⚓', '🌊'],
  },
  {
    id: 'garten', title: 'Garten', color: '#4f9a3c', bg: '#e9f6dc',
    emoji: ['🌱', '🪴', '🌵', '🌳', '🌲', '🍄', '🐌', '🐝', '🐞', '🦋', '🐛', '🪺', '🥕', '🥬', '🌽', '🥒', '🧺', '🪱'],
  },
  {
    id: 'herbst', title: 'Herbst', color: '#d27a2c', bg: '#fff0de',
    emoji: ['🍁', '🍂', '🍄', '🎃', '🌰', '🦔', '🐿️', '🍎', '🍐', '🥧', '☕', '🧣', '🌾', '🦉', '🕯️', '🍠', '🦊', '🍇'],
  },
  {
    id: 'winter', title: 'Winter & Weihnachten', color: '#3a8ccf', bg: '#e8f2fb',
    emoji: ['⛄', '❄️', '🎄', '🎁', '🔔', '⭐', '🕯️', '🧦', '🧤', '🧣', '🍪', '🦌', '🛷', '⛸️', '🎅', '🤶', '☕', '🎀'],
  },
  {
    id: 'reisen', title: 'Reisen', color: '#2aa198', bg: '#e2f6f3',
    emoji: ['✈️', '🚂', '🚢', '🗺️', '🧳', '🏖️', '🏝️', '🗼', '🏰', '🎡', '⛺', '🚲', '🚗', '🚌', '🛶', '🧭', '📷', '🎒', '🚠', '🌋'],
  },
  {
    id: 'kueche', title: 'Küche', color: '#cf8a2e', bg: '#fff3dc',
    emoji: ['🍳', '🥐', '🥖', '🧀', '🥗', '🍝', '🍕', '🥨', '🍞', '🥚', '🧈', '🥄', '🫖', '🥛', '🧂', '🍲', '🥯', '🫕'],
  },
  {
    id: 'musik', title: 'Musik', color: '#8a63d2', bg: '#efe8ff',
    emoji: ['🎵', '🎸', '🎹', '🎺', '🎻', '🥁', '🎷', '🪕', '🪗', '🎤', '🎧', '📻', '🎼', '🪘', '🪇', '🪈', '🔔', '💿'],
  },
  {
    id: 'sport', title: 'Sport', color: '#e2683c', bg: '#ffeee4',
    emoji: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '⛳', '🏆', '🥇', '🛼', '⛸️', '🎳', '🏒', '🛹'],
  },
  {
    id: 'party', title: 'Party', color: '#d64fa0', bg: '#ffe6f4',
    emoji: ['🎉', '🎊', '🎈', '🎁', '🎂', '🥳', '🪅', '🎀', '🍾', '🥂', '🎆', '✨', '🪩', '🍰', '🍭', '🧁', '🎶', '🍿'],
  },
  {
    id: 'himmel', title: 'Himmel & Wetter', color: '#4b7fd6', bg: '#e6efff',
    emoji: ['☀️', '🌤️', '⛅', '🌈', '☁️', '🌙', '⭐', '✨', '☄️', '🪐', '🌍', '🌧️', '⚡', '❄️', '🌪️', '💫', '☔', '🌊'],
  },
  {
    id: 'mode', title: 'Mode & Schmuck', color: '#c64f7d', bg: '#ffe9f0',
    emoji: ['👗', '👠', '👜', '👒', '💄', '💍', '💎', '👛', '🕶️', '👑', '🧣', '👢', '🎀', '🪭', '🧥', '👚', '🩰', '🪮'],
  },
  {
    id: 'spielzeug', title: 'Spielzeug', color: '#e0a020', bg: '#fff5d8',
    emoji: ['🧸', '🪀', '🪁', '🎲', '🧩', '🪆', '🎨', '🖍️', '🎠', '🚂', '🎈', '🪄', '🎯', '🛝', '🤖', '🚀', '🧶', '🎮'],
  },
  {
    id: 'fruehling', title: 'Frühling', color: '#63b04a', bg: '#eef8e2',
    emoji: ['🐣', '🌷', '🐝', '🦋', '🌸', '🐰', '🥚', '🌈', '☔', '🐤', '🌼', '🪺', '🐞', '🌱', '🍓', '🪻', '🧺', '🐑'],
  },
  {
    id: 'wohlfuehlen', title: 'Wohlfühlen', color: '#4fb3a8', bg: '#e3f6f2',
    emoji: ['🛁', '🧴', '🧼', '🕯️', '🍵', '🪷', '🌿', '🧖', '💆', '🧘', '🫧', '🌸', '🍋', '🥒', '🪞', '💅', '🧦', '📖'],
  },
];

export function themeById(id) {
  return themes.find((t) => t.id === id) || null;
}

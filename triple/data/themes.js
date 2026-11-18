// Dreierlei – Themen (Bildersätze für die Steine).
//
// Jedes Level gehört zu einem Thema. Pro Level werden daraus so viele Bilder gewählt,
// wie das Level verschiedene Steinsorten braucht (4 bis 16). Mehr Bilder = mehr Abwechslung.
//
// Felder:
//   id     eindeutig, nur a-z0-9-
//   title  Anzeigename (Deutsch, Schweizer Schreibweise)
//   title_en, short_en  englische Fassung (Pflicht)
//   short  (optional) Kurzname für die schmale Titelzeile im Spiel, wenn «title» länger als ~14 Zeichen ist
//   color  Akzentfarbe des Themas (Fortschrittsbalken, Funken)
//   bg     zarte Hintergrundfarbe der Spielfläche (sehr hell!)
//   emoji  mindestens 16 verschiedene Emoji, gut unterscheidbar (keine Fast-Doppelgänger –
//          siehe «lookalikes» unten; der Test prüft, dass pro Thema höchstens eines je Gruppe vorkommt)
//
// Neues Thema: einfach einen Eintrag ans Ende anhängen – fertig (siehe CONTENT.md).

export const themes = [
  {
    id: 'obst', title: 'Obst', title_en: 'Fruit', color: '#e2525c', bg: '#ffe9e4',
    emoji: ['🍓', '🍒', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🫐', '🍍', '🥝', '🍑', '🥭', '🍈', '🥥', '🌰'],
  },
  {
    id: 'blumen', title: 'Blumen', title_en: 'Flowers', color: '#e2699a', bg: '#ffe8f1',
    emoji: ['🌸', '🌷', '🌹', '🌺', '🌻', '🦋', '💐', '🪷', '🪻', '🐝', '🍀', '🐞', '🌱', '🧺', '🌾', '🪴', '🐛'],
  },
  {
    id: 'tiere', title: 'Tiere', title_en: 'Animals', color: '#d08a3c', bg: '#fff0dc',
    emoji: ['🐶', '🐱', '🐭', '🦒', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦉', '🦄'],
  },
  {
    id: 'suesses', title: 'Süsses', title_en: 'Sweets', color: '#d9709e', bg: '#ffeaf3',
    emoji: ['🍰', '🧁', '🍩', '🍪', '🍫', '🍬', '🍭', '🍮', '🍯', '🍦', '🍨', '🍿', '🍒', '🥧', '🧇', '🥞', '🍡', '🍓'],
  },
  {
    id: 'meer', title: 'Meer', title_en: 'Sea', color: '#2f8fd0', bg: '#e3f3ff',
    emoji: ['🐠', '🐟', '🐡', '🐬', '🐳', '🦈', '🐙', '⛵', '🦀', '⛱️', '🦐', '🐚', '🪸', '🐢', '🦭', '🪼', '⚓', '🌊'],
  },
  {
    id: 'garten', title: 'Garten', title_en: 'Garden', color: '#4f9a3c', bg: '#e9f6dc',
    emoji: ['🌱', '🪴', '🌵', '🌳', '🌲', '🍄', '🐌', '🐝', '🐞', '🦋', '🐛', '🪺', '🥕', '🥬', '🌽', '🥒', '🧺', '🪱'],
  },
  {
    id: 'herbst', title: 'Herbst', title_en: 'Autumn', color: '#d27a2c', bg: '#fff0de',
    emoji: ['🍁', '🌂', '🍄', '🎃', '🌰', '🦔', '🐿️', '🍎', '🍐', '🥧', '☕', '🧣', '🌾', '🦉', '🕯️', '🥾', '🦊', '🍇'],
  },
  {
    id: 'winter', title: 'Winter & Weihnachten', short: 'Winter', title_en: 'Winter & Christmas', short_en: 'Winter', color: '#3a8ccf', bg: '#e8f2fb',
    emoji: ['⛄', '❄️', '🎄', '🎁', '🔔', '⭐', '🕯️', '🧦', '🧤', '🧣', '🍪', '🦌', '🛷', '⛸️', '🎅', '🍊', '☕', '🎀'],
  },
  {
    id: 'reisen', title: 'Reisen', title_en: 'Travel', color: '#2aa198', bg: '#e2f6f3',
    emoji: ['✈️', '🚂', '🚢', '🗺️', '🧳', '🏖️', '🕶️', '🗼', '🏰', '🎡', '⛺', '🚲', '🚗', '🚌', '🛶', '🧭', '📷', '🎒', '🚠', '🌋'],
  },
  {
    id: 'kueche', title: 'Küche', title_en: 'Kitchen', color: '#cf8a2e', bg: '#fff3dc',
    emoji: ['🍳', '🥐', '🥖', '🧀', '🥗', '🍝', '🍕', '🥨', '🍞', '🥚', '🥕', '🥄', '🫖', '🥛', '🧂', '🍅', '🥯', '🫕'],
  },
  {
    id: 'musik', title: 'Musik', title_en: 'Music', color: '#8a63d2', bg: '#efe8ff',
    emoji: ['🎵', '🎸', '🎹', '🎺', '🎻', '🥁', '🎷', '🪕', '🪗', '🎤', '🎧', '📻', '🎼', '🪩', '🪇', '🪈', '🔔', '💿'],
  },
  {
    id: 'sport', title: 'Sport', title_en: 'Sports', color: '#e2683c', bg: '#ffeee4',
    emoji: ['⚽', '🏀', '🏈', '⚾', '🎾', '🎿', '🏹', '🎱', '🏓', '🏸', '🥊', '⛳', '🏆', '🥇', '🤿', '⛸️', '🎳', '🏒', '🛹'],
  },
  {
    id: 'party', title: 'Party', title_en: 'Party', color: '#d64fa0', bg: '#ffe6f4',
    emoji: ['🎉', '🎊', '🎈', '🎁', '🎂', '🥳', '🪅', '🎀', '🍾', '🥂', '🎆', '✨', '🪩', '🎭', '🍭', '🧁', '🎶', '🍿'],
  },
  {
    id: 'himmel', title: 'Himmel & Wetter', short: 'Himmel', title_en: 'Sky & Weather', short_en: 'Sky', color: '#4b7fd6', bg: '#e6efff',
    emoji: ['☀️', '🌅', '🪁', '🌈', '🌌', '🌙', '⭐', '✨', '☄️', '🪐', '🌍', '🌧️', '⚡', '❄️', '🌪️', '🌡️', '☔', '🌊'],
  },
  {
    id: 'mode', title: 'Mode & Schmuck', short: 'Mode', title_en: 'Fashion & Jewelry', short_en: 'Fashion', color: '#c64f7d', bg: '#ffe9f0',
    emoji: ['👗', '👠', '👜', '👒', '💄', '💍', '💎', '⌚', '🕶️', '👑', '🧣', '👢', '🎀', '🪭', '🧥', '🧵', '🩰', '🪮'],
  },
  {
    id: 'spielzeug', title: 'Spielzeug', title_en: 'Toys', color: '#e0a020', bg: '#fff5d8',
    emoji: ['🧸', '🪀', '🪁', '🎲', '🧩', '🪆', '🎨', '🖍️', '🎠', '🚂', '🎈', '🪄', '🎯', '🛝', '🤖', '🚀', '🧶', '🎮'],
  },
  {
    id: 'fruehling', title: 'Frühling', title_en: 'Spring', color: '#63b04a', bg: '#eef8e2',
    emoji: ['🐣', '🌷', '🐝', '🦋', '🌸', '🐰', '🥚', '🌈', '☔', '🪁', '🌼', '🪺', '🐞', '🌱', '🍓', '🪻', '🧺', '🐑'],
  },
  {
    id: 'wohlfuehlen', title: 'Wohlfühlen', title_en: 'Wellness', color: '#4fb3a8', bg: '#e3f6f2',
    emoji: ['🛁', '🧴', '🧼', '🕯️', '🍵', '🪷', '🌿', '🧖', '🛋️', '🧘', '🫧', '🌸', '🍋', '🥒', '🪞', '💅', '🧦', '📖'],
  },
];

/**
 * Fast-Doppelgänger: Emoji, die auf einem kleinen Stein (bes. mit Apple-Emoji) leicht verwechselt
 * werden. Pro Thema darf höchstens EIN Emoji jeder Gruppe vorkommen (tests/logic.test.mjs prüft das).
 * Fällt dir ein weiteres verwechselbares Paar auf: hier als Gruppe ergänzen und das Thema anpassen.
 */
export const lookalikes = [
  ['☀️', '🌤️', '⛅', '🌥️', '🌦️'],          // Sonne (mit Wolke)
  ['☁️', '⛅', '🌥️', '🌦️', '🌧️', '🌨️', '🌩️'], // Wolken
  ['✨', '💫', '🌟'],
  ['⭐', '🌟'],
  ['☄️', '🌠'],
  ['🌅', '🌄'],
  ['🏈', '🏉'],
  ['⚾', '🏐', '🥎'],
  ['⛸️', '🛼'],
  ['🌻', '🌼'],
  ['🌹', '🥀'],
  ['🌿', '🍃', '🌱', '☘️'],
  ['🌸', '💮'],
  ['🍨', '🍧'],
  ['🍰', '🎂'],
  ['🥧', '🥮'],
  ['🐭', '🐹'],
  ['🐴', '🦄'],
  ['🐣', '🐤', '🐥'],
  ['🐙', '🦑'],
  ['🦀', '🦞'],
  ['🎅', '🤶'],
  ['🥁', '🪘'],
  ['🎵', '🎶'],
  ['🎤', '🎙️'],
  ['🍲', '🫕', '🥘'],
  ['🧀', '🧈'],
  ['🍎', '🍅'],
  ['🍁', '🍂'],
  ['🌰', '🍠'],
  ['🏖️', '🏝️'],
  ['🏔️', '⛰️', '🌋'],
  ['⛺', '🏕️'],
  ['👜', '👛'],
  ['👗', '👚'],
  ['🧖', '💆'],
];

export function themeById(id) {
  return themes.find((t) => t.id === id) || null;
}

/** Englische Titel übernehmen (einmal beim Start der App, wenn die Sprache Englisch ist). */
export function localizeThemes(lang) {
  if (lang !== 'en') return;
  for (const t of themes) {
    if (!t.title_en) continue;
    t.title = t.title_en;
    t.short = t.short_en || undefined;
  }
}

/** Kurzname für die Titelzeile im Spiel. */
export function themeShort(t) {
  return (t && (t.short || t.title)) || '';
}

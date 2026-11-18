// Verdoppeln / Double Up – alle Texte auf Deutsch und Englisch (über /shared/i18n.js).
//
//   import { t, tn, loc } from './i18n.js';
//   t('level', { n: 7 })            // «Etappe 7» / «Level 7»
//   tn('nextUndo', 3)               // Einzahl/Mehrzahl: Schlüssel «…_one» / «…_other», {n} wird ersetzt
//   loc(skin, 'title')              // Inhalte aus data/: Feld «title» bzw. «title_en»
//
// Neue Texte immer in BEIDEN Sprachen eintragen (tests/i18n.test.mjs prüft das).
// Englisch: amerikanische Schreibweise, kurz und freundlich.

import { dict, lang, L, isEn } from '../shared/i18n.js';

export { lang, L, isEn };

export const table = {
  de: {
    // Allgemein
    gameTitle: 'Verdoppeln',
    pageTitle: 'Verdoppeln – Spielpause',
    tagline: 'Wischen, verschmelzen, wachsen.',
    howTo: 'So geht’s',
    play: 'Spielen',
    continue: 'Weiterspielen',
    points: '{n} Punkte',
    goalValue: 'Ziel {v}',
    level: 'Etappe {n}',
    levels: 'Etappen',
    levelRange: 'Etappe {a}–{b}',
    round: '{name} · Runde {n}',
    close: 'Schliessen',
    done: 'Fertig',
    cancel: 'Abbrechen',

    // Startbildschirm
    modeLabel: 'Spielart',
    freePlay: 'Freies Spiel',
    boardsCount: '{n} Bretter',
    boardLabel: 'Brett',
    map: 'Karte',
    chapterProgress: '{n} von {total} geschafft',
    levelsBlurb: 'Steine, Lücken, eigene Ziele',
    stats: 'Statistik',
    album: 'Album',
    style: 'Aussehen',
    statCleared: 'Geschafft',
    statStars: 'Sterne',
    stat3Stars: '3 Sterne',
    statBest: 'Rekord',
    statBestTile: 'Beste Kachel',
    statGoals: 'Ziel erreicht',

    // Aussehen
    styleTiles: '{n} Stufen',
    styleNote: 'Gilt für das freie Spiel. Etappen haben ihren eigenen Stil.',

    // Statistik
    colMode: 'Modus',
    colBest: 'Rekord',
    colTile: 'Kachel',
    colGames: 'Spiele',
    statTopTile: 'Höchste Kachel',
    statMoves: 'Züge',
    statMerges: 'Verschmolzen',

    // Karte
    lockedLevel: 'Schaffe zuerst Etappe {n}.',

    // Album
    albumFound: '{have} von {total} entdeckt',
    albumAll: 'Alles entdeckt – grossartig!',
    albumHint: 'Neue Kacheln entdeckst du, indem du sie im Spiel baust.',
    useStyle: 'Stil «{name}» verwenden',
    styleOn: 'Stil «{name}» aktiv',
    styleActive: '✓ Dieser Stil ist im freien Spiel aktiv.',

    // Spiel
    score: 'Punkte',
    moves: 'Züge',
    best: 'Rekord',
    goal: 'Ziel',
    reached: 'Geschafft',
    undo: 'Zurück',
    undoAria: 'Rückgängig',
    hint: 'Tipp',
    newShort: 'Neu',
    newGame: 'Neues Spiel',
    restartShort: 'Neustart',
    restart: 'Neu starten',
    coach: 'Wische über das Brett',
    newInAlbum: 'Neu im Album: {name}',
    newRecord: 'Neuer Rekord!',
    newTopTile: 'Neue Höchstkachel: {name}',
    noMoveYet: 'Noch kein Zug gemacht',
    nextUndo_one: 'Nächstes Rückgängig in {n} Zug',
    nextUndo_other: 'Nächstes Rückgängig in {n} Zügen',
    restartLevelQ: 'Etappe neu starten?',
    newGameQ: 'Neues Spiel?',
    progressLost: 'Der aktuelle Spielstand geht verloren.',
    praise1: 'Super!',
    praise2: 'Klasse!',
    praise3: 'Fantastisch!',

    // Gewinn / Spielende
    winTitle: 'Geschafft!',
    winText: 'Du hast {tile} erreicht – mit {score} Punkten.',
    winMore: 'Du kannst weiterspielen und noch grössere Kacheln bauen.',
    keepPlaying: 'Weiterspielen',
    toMenu: 'Zum Menü',
    overTitle: 'Keine Züge mehr',
    boardFull: 'Das Brett ist voll.',
    countMade: 'Geschafft: {made} von {n}.',
    goalWas: 'Ziel war {tile}.',
    recordBig: '🏆 Neuer Rekord!',
    undosLeft_one: 'Du hast noch {n}× Rückgängig.',
    undosLeft_other: 'Du hast noch {n}× Rückgängig.',
    tryAgain: 'Nochmal versuchen',
    toMap: 'Zur Karte',
    levelDoneTitle: 'Etappe {n} geschafft!',
    levelDoneText: 'Ziel erreicht in {n} Zügen.',
    starsFor: 'Für {s} Sterne: höchstens {n} Züge.',
    perfect: 'Perfekt – alle drei Sterne!',
    nextLevel: 'Nächste Etappe',
    playAgain: 'Nochmal spielen',

    // Anleitung
    tut1Title: 'Wischen',
    tut1Text: 'Alle Kacheln rutschen mit – zwei gleiche verschmelzen zur nächsten Stufe.',
    tut2Title: 'Ziel-Kachel bauen',
    tut2Text: 'Verschmilz weiter, bis die Ziel-Kachel da ist – danach darfst du weiterspielen.',
    tut3Title: 'Zurück und Tipp',
    tut3Text: '«Tipp» zeigt einen guten Zug, «Zurück» nimmt einen Zug zurück.',
    tut4Title: 'Etappen',
    tut4Text: 'Steine bleiben liegen – mit wenigen Zügen gibt es mehr Sterne.',

    // Kurztext für die Startseite
    sumBest: 'Rekord {n}',
    sumLevel: 'Etappe {n}',
    sumNone: 'Noch nicht gespielt',
  },
  en: {
    gameTitle: 'Double Up',
    pageTitle: 'Double Up – Spielpause',
    tagline: 'Swipe, merge, grow.',
    howTo: 'How to play',
    play: 'Play',
    continue: 'Continue',
    points: '{n} points',
    goalValue: 'Goal {v}',
    level: 'Level {n}',
    levels: 'Levels',
    levelRange: 'Levels {a}–{b}',
    round: '{name} · Round {n}',
    close: 'Close',
    done: 'Done',
    cancel: 'Cancel',

    modeLabel: 'Mode',
    freePlay: 'Free play',
    boardsCount: '{n} boards',
    boardLabel: 'Board',
    map: 'Map',
    chapterProgress: '{n} of {total} cleared',
    levelsBlurb: 'Stones, gaps, special goals',
    stats: 'Stats',
    album: 'Album',
    style: 'Style',
    statCleared: 'Cleared',
    statStars: 'Stars',
    stat3Stars: '3 stars',
    statBest: 'Best',
    statBestTile: 'Best tile',
    statGoals: 'Goals reached',

    styleTiles: '{n} tiles',
    styleNote: 'For free play. Levels have their own style.',

    colMode: 'Mode',
    colBest: 'Best',
    colTile: 'Tile',
    colGames: 'Games',
    statTopTile: 'Top tile',
    statMoves: 'Moves',
    statMerges: 'Merges',

    lockedLevel: 'Clear level {n} first.',

    albumFound: '{have} of {total} found',
    albumAll: 'All found – amazing!',
    albumHint: 'Build new tiles in the game to discover them.',
    useStyle: 'Use the “{name}” style',
    styleOn: '“{name}” style on',
    styleActive: '✓ This style is on for free play.',

    score: 'Score',
    moves: 'Moves',
    best: 'Best',
    goal: 'Goal',
    reached: 'Reached',
    undo: 'Undo',
    undoAria: 'Undo',
    hint: 'Hint',
    newShort: 'New',
    newGame: 'New game',
    restartShort: 'Restart',
    restart: 'Restart',
    coach: 'Swipe across the board',
    newInAlbum: 'New in the album: {name}',
    newRecord: 'New best!',
    newTopTile: 'New top tile: {name}',
    noMoveYet: 'No moves yet',
    nextUndo_one: 'Next undo in {n} move',
    nextUndo_other: 'Next undo in {n} moves',
    restartLevelQ: 'Restart this level?',
    newGameQ: 'Start a new game?',
    progressLost: 'Your current game will be lost.',
    praise1: 'Great!',
    praise2: 'Awesome!',
    praise3: 'Fantastic!',

    winTitle: 'You did it!',
    winText: 'You made {tile} – with {score} points.',
    winMore: 'Keep playing to build even bigger tiles.',
    keepPlaying: 'Keep playing',
    toMenu: 'Menu',
    overTitle: 'No moves left',
    boardFull: 'The board is full.',
    countMade: 'Made: {made} of {n}.',
    goalWas: 'The goal was {tile}.',
    recordBig: '🏆 New best!',
    undosLeft_one: 'You have 1 undo left.',
    undosLeft_other: 'You have {n} undos left.',
    tryAgain: 'Try again',
    toMap: 'Level map',
    levelDoneTitle: 'Level {n} complete!',
    levelDoneText: 'Goal reached in {n} moves.',
    starsFor: 'For {s} stars: {n} moves or fewer.',
    perfect: 'Perfect – all three stars!',
    nextLevel: 'Next level',
    playAgain: 'Play again',

    tut1Title: 'Swipe',
    tut1Text: 'All tiles slide – two matching tiles merge into the next one.',
    tut2Title: 'Build the goal tile',
    tut2Text: 'Keep merging until the goal tile appears – then play on if you like.',
    tut3Title: 'Undo and hint',
    tut3Text: '“Hint” shows a good move, “Undo” takes one back.',
    tut4Title: 'Levels',
    tut4Text: 'Stones stay put – fewer moves earn more stars.',

    sumBest: 'Best {n}',
    sumLevel: 'Level {n}',
    sumNone: 'Not played yet',
  },
};

export const t = dict(table);

/** Einzahl/Mehrzahl: tn('nextUndo', 3) → Schlüssel «nextUndo_other» mit {n} = 3. */
export function tn(key, n, vars = {}) {
  return t(`${key}_${n === 1 ? 'one' : 'other'}`, { n, ...vars });
}

/** Inhalte aus data/ (Stile, Kacheln, Modi, Kapitel, Tipps): Feld oder Feld + «_en». */
export function loc(obj, field) {
  if (!obj) return '';
  return lang === 'en' && obj[field + '_en'] != null ? obj[field + '_en'] : obj[field];
}

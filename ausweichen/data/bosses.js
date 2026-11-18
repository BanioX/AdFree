// Bosse zum Ausweichen. Kein Schiessen: die Ausdauer sinkt, bis der Riese müde ist.

export function bosses(lang) {
  const en = lang === 'en';
  const eye = (ox, oy) => ({ ox, oy });
  return [
    {
      id: 'lupe', name: en ? 'LENS' : 'LUPE', bar: en ? 'AWAKE' : 'WACH',
      pal: 'magenta', kind: 'lupe', hp: 100, fatigueTime: 18,
      x: 90, y: 108, hw: 62, hh: 58, playTop: 184, bob: 1,
      eyes: [eye(-22, -40), eye(22, -40)],
      core: { ox: 0, oy: 20, r: 8 }, bodyHurt: 0, coreHurt: 0,
      phases: [
        { until: 0, steps: [
          { kind: 'focus', dur: 2.8, warn: 0.65, fromX: 24, toX: 156, width: 9 },
          { kind: 'wait', dur: 0.55 },
          { kind: 'bar', dur: 2.3, warn: 0.55, fromY: 188, toY: 286, height: 10 },
          { kind: 'wait', dur: 0.4 },
        ]},
        { until: 0, steps: [
          { kind: 'focus', dur: 2.2, warn: 0.5, fromX: 156, toX: 28, width: 9 },
          { kind: 'bar', dur: 2.0, warn: 0.45, fromY: 280, toY: 176, height: 10 },
        ]},
        { until: 0, steps: [
          { kind: 'focus', dur: 1.9, warn: 0.42, fromX: 30, toX: 150, width: 10 },
          { kind: 'wait', dur: 0.7 },
          { kind: 'bar', dur: 2.4, warn: 0.5, fromY: 170, toY: 300, height: 8 },
        ]},
      ],
    },
    {
      id: 'boeller', name: en ? 'SALVO' : 'BOELLER', bar: en ? 'AWAKE' : 'WACH',
      pal: 'cyan', kind: 'boeller', hp: 100, fatigueTime: 26,
      x: 90, y: 106, hw: 64, hh: 56, playTop: 180,
      eyes: [eye(-8, -36), eye(8, -36)],
      core: { ox: 0, oy: 10, r: 8 }, bodyHurt: 0, coreHurt: 0,
      phases: [
        { until: 0, steps: [
          { kind: 'cannon', dur: 2.0, warn: 0.5, shots: 3, every: 0.42, speed: 78, oy: 12 },
          { kind: 'wait', dur: 0.4 },
          { kind: 'drop', dur: 2.0, warn: 0.3, shots: 3, every: 0.5, speed: 100 },
        ]},
        { until: 0, steps: [
          { kind: 'cannon', dur: 1.8, warn: 0.4, shots: 4, every: 0.32, speed: 92, ox: -30, oy: 6 },
          { kind: 'ring', dur: 1.5, warn: 0.42, count: 12, speed: 52, gap: 1.15 },
          { kind: 'drop', dur: 1.8, warn: 0.28, shots: 3, every: 0.42, speed: 112 },
        ]},
        { until: 0, steps: [
          { kind: 'ring', dur: 1.45, warn: 0.4, count: 14, speed: 58, gap: 1.05 },
          { kind: 'cannon', dur: 1.7, warn: 0.38, shots: 5, every: 0.26, speed: 96, oy: 8 },
          { kind: 'wait', dur: 0.45 },
        ]},
      ],
    },
    {
      id: 'wirbel', name: en ? 'SWIRL' : 'WIRBEL', bar: en ? 'AWAKE' : 'WACH',
      pal: 'purple', kind: 'wirbel', hp: 100, fatigueTime: 32,
      x: 90, y: 108, hw: 62, hh: 56, playTop: 182,
      eyes: [eye(-16, -40), eye(16, -40)],
      core: { ox: 0, oy: 12, r: 8 }, bodyHurt: 0, coreHurt: 0,
      phases: [
        { until: 0, steps: [
          { kind: 'focus', dur: 2.3, warn: 0.5, fromX: 36, toX: 144, width: 8 },
          { kind: 'home', dur: 1.6, warn: 0.4, shots: 2, every: 0.5, speed: 32, turn: 1.2 },
        ]},
        { until: 0, steps: [
          { kind: 'curtain', dur: 2.4, warn: 0.45, cols: 8, gap: 3, speed: 54, drift: 0.35 },
          { kind: 'bar', dur: 1.9, warn: 0.45, fromY: 200, toY: 290, height: 8 },
          { kind: 'home', dur: 1.5, warn: 0.36, shots: 2, every: 0.48, speed: 34, turn: 1.3 },
        ]},
        { until: 0, steps: [
          { kind: 'focus', dur: 2.0, warn: 0.42, fromX: 150, toX: 24, width: 8 },
          { kind: 'ring', dur: 1.4, warn: 0.4, count: 13, speed: 50, gap: 1.1 },
          { kind: 'wait', dur: 0.55 },
        ]},
      ],
    },
  ];
}

// Bosse der Riesenjagd. Schritte: siehe lib/retro/sim.js (laser, focus, cannon, …).

export function bosses(lang) {
  const en = lang === 'en';
  const eye = (ox, oy) => ({ ox, oy });
  return [
    {
      id: 'glut', name: en ? 'EMBER' : 'GLUT', bar: en ? 'EMBER' : 'GLUT',
      pal: 'magenta', kind: 'glut', hp: 150,
      x: 90, y: 108, hw: 62, hh: 58, playTop: 184,
      eyes: [eye(-24, -46), eye(24, -46)],
      core: { ox: 0, oy: 48, r: 14 }, bodyHurt: 1, coreHurt: 2,
      phases: [
        { until: 0.66, steps: [
          { kind: 'focus', dur: 2.6, warn: 0.6, fromX: 18, toX: 162, width: 8 },
          { kind: 'wait', dur: 0.45 },
          { kind: 'cannon', dur: 1.9, warn: 0.45, shots: 3, every: 0.42, speed: 86, oy: 20 },
        ]},
        { until: 0.33, steps: [
          { kind: 'focus', dur: 2.15, warn: 0.48, fromX: 162, toX: 18, width: 8 },
          { kind: 'ring', dur: 1.45, warn: 0.4, count: 14, speed: 54, gap: 1.05 },
          { kind: 'cannon', dur: 1.7, warn: 0.4, shots: 4, every: 0.32, speed: 96, oy: 18 },
        ]},
        { until: 0, steps: [
          { kind: 'laser', dur: 2.0, warn: 0.42, from: -1.05, to: 1.05, width: 9, eyes: [0] },
          { kind: 'home', dur: 1.7, warn: 0.36, shots: 3, every: 0.4, speed: 38, turn: 1.45 },
          { kind: 'cannon', dur: 1.5, warn: 0.36, shots: 5, every: 0.26, speed: 100, oy: 16 },
        ]},
      ],
    },
    {
      id: 'dock', name: en ? 'WELD' : 'DOCK', bar: en ? 'WELD' : 'DOCK',
      pal: 'cyan', kind: 'dock', hp: 185,
      x: 90, y: 104, hw: 58, hh: 58, playTop: 180,
      eyes: [eye(-62, -6), eye(36, -8)],
      core: { ox: 0, oy: 42, r: 13 }, bodyHurt: 1, coreHurt: 2,
      phases: [
        { until: 0.66, steps: [
          { kind: 'cannon', dur: 1.8, warn: 0.42, shots: 4, every: 0.3, speed: 100, ox: 40, oy: -6 },
          { kind: 'bar', dur: 2.2, warn: 0.5, fromY: 176, toY: 292, height: 9 },
          { kind: 'wait', dur: 0.35 },
        ]},
        { until: 0.33, steps: [
          { kind: 'laser', dur: 2.05, warn: 0.45, from: -0.95, to: 0.95, width: 8, eyes: [0] },
          { kind: 'home', dur: 1.6, warn: 0.34, shots: 2, every: 0.5, speed: 36, turn: 1.5 },
          { kind: 'cannon', dur: 1.55, warn: 0.36, shots: 5, every: 0.24, speed: 108, ox: 42, oy: -6 },
        ]},
        { until: 0, steps: [
          { kind: 'bar', dur: 1.8, warn: 0.4, fromY: 290, toY: 180, height: 10 },
          { kind: 'ring', dur: 1.4, warn: 0.38, count: 16, speed: 60, gap: 0.95 },
          { kind: 'laser', dur: 1.7, warn: 0.36, from: 0.9, to: -0.9, width: 8, eyes: [0] },
        ]},
      ],
    },
    {
      id: 'kiel', name: en ? 'KEEL' : 'KIEL', bar: en ? 'KEEL' : 'KIEL',
      pal: 'teal', kind: 'kiel', hp: 210,
      x: 90, y: 112, hw: 72, hh: 48, playTop: 176,
      eyes: [eye(-8, -16), eye(8, -16)],
      core: { ox: 0, oy: 36, r: 13 }, bodyHurt: 1, coreHurt: 2.2,
      phases: [
        { until: 0.66, steps: [
          { kind: 'curtain', dur: 2.5, warn: 0.45, cols: 8, gap: 3, speed: 58, drift: 0.4 },
          { kind: 'cannon', dur: 1.5, warn: 0.4, shots: 3, every: 0.36, speed: 90, oy: -8 },
        ]},
        { until: 0.33, steps: [
          { kind: 'drop', dur: 2.2, warn: 0.3, shots: 4, every: 0.42, speed: 120 },
          { kind: 'ring', dur: 1.4, warn: 0.4, count: 15, speed: 56, gap: 1 },
          { kind: 'curtain', dur: 2.2, warn: 0.4, cols: 9, gap: 2, speed: 66, drift: 0.7 },
        ]},
        { until: 0, steps: [
          { kind: 'curtain', dur: 2.3, warn: 0.36, cols: 9, gap: 2, speed: 74, drift: 0.9 },
          { kind: 'home', dur: 1.6, warn: 0.32, shots: 3, every: 0.38, speed: 42, turn: 1.7 },
          { kind: 'cannon', dur: 1.4, warn: 0.32, shots: 6, every: 0.2, speed: 112, oy: 0 },
        ]},
      ],
    },
    {
      id: 'krone', name: en ? 'CROWN' : 'KRONE', bar: en ? 'CROWN' : 'KRONE',
      pal: 'purple', kind: 'krone', hp: 250,
      x: 90, y: 108, hw: 62, hh: 58, playTop: 184,
      eyes: [eye(-16, -42), eye(16, -42)],
      core: { ox: 0, oy: 44, r: 13 }, bodyHurt: 0.45, coreHurt: 2.4,
      coreClosedDuring: ['laser', 'focus', 'bar'],
      phases: [
        { until: 0.66, steps: [
          { kind: 'focus', dur: 2.3, warn: 0.5, fromX: 24, toX: 156, width: 8 },
          { kind: 'cannon', dur: 1.6, warn: 0.4, shots: 4, every: 0.3, speed: 98, oy: 16 },
        ]},
        { until: 0.33, steps: [
          { kind: 'bar', dur: 1.9, warn: 0.42, fromY: 188, toY: 300, height: 9 },
          { kind: 'ring', dur: 1.35, warn: 0.36, count: 16, speed: 62, gap: 0.9 },
          { kind: 'home', dur: 1.55, warn: 0.32, shots: 3, every: 0.36, speed: 40, turn: 1.6 },
        ]},
        { until: 0, steps: [
          { kind: 'laser', dur: 1.7, warn: 0.36, from: -1.1, to: 1.1, width: 8, eyes: [0, 1] },
          { kind: 'curtain', dur: 2.1, warn: 0.34, cols: 9, gap: 2, speed: 78, drift: 1 },
          { kind: 'home', dur: 1.4, warn: 0.3, shots: 3, every: 0.32, speed: 46, turn: 1.85 },
          { kind: 'focus', dur: 1.85, warn: 0.38, fromX: 150, toX: 30, width: 9 },
        ]},
      ],
    },
  ];
}

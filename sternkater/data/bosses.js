// Seitliche Bosskämpfe. Der Held schiesst waagrecht, der Kern wandert mit der Stufe.

const floor = { x: 0, y: 300, w: 112, h: 20, floor: true };

export function bosses(lang) {
  const en = lang === 'en';
  const eye = (ox, oy) => ({ ox, oy });
  return [
    {
      id: 'akte', name: en ? 'FILE' : 'AKTE', bar: en ? 'FILE' : 'AKTE',
      pal: 'purple', kind: 'akte', hp: 140,
      x: 148, y: 210, hw: 32, hh: 88, bob: 0,
      eyes: [eye(-6, -34), eye(8, -34)],
      core: { ox: -16, oy: 78, r: 14 },
      coreByPhase: [{ oy: 78 }, { oy: 8 }, { oy: -32 }],
      bodyHurt: 0.6, coreHurt: 2.2,
      platforms: [
        floor,
        { x: 12, y: 271, w: 62, h: 8 },
        { x: 8, y: 227, w: 48, h: 8 },
        { x: 40, y: 187, w: 44, h: 8 },
      ],
      phases: [
        { until: 0.66, steps: [
          { kind: 'wait', dur: 0.9 },
          { kind: 'shock', dur: 1.7, warn: 0.55, y: 300, band: 14, reach: 112 },
          { kind: 'arc', dur: 1.8, warn: 0.42, shots: 3, every: 0.42, speed: 78 },
          { kind: 'wait', dur: 0.35 },
        ]},
        { until: 0.33, steps: [
          { kind: 'bar', dur: 2.1, warn: 0.48, fromY: 250, toY: 150, height: 8 },
          { kind: 'arc', dur: 1.6, warn: 0.38, shots: 3, every: 0.38, speed: 88 },
          { kind: 'drop', dur: 1.8, warn: 0.3, shots: 3, every: 0.45, speed: 110 },
        ]},
        { until: 0, steps: [
          { kind: 'shock', dur: 1.45, warn: 0.42, y: 300, band: 14, reach: 112 },
          { kind: 'home', dur: 1.6, warn: 0.36, shots: 2, every: 0.5, speed: 36, turn: 1.3 },
          { kind: 'arc', dur: 1.5, warn: 0.34, shots: 4, every: 0.3, speed: 96 },
        ]},
      ],
    },
    {
      id: 'nimbus', name: 'NIMBUS', bar: 'NIMBUS',
      pal: 'magenta', kind: 'nimbus', hp: 160,
      x: 146, y: 190, hw: 34, hh: 108,
      eyes: [eye(-8, -18), eye(8, -18)],
      core: { ox: -14, oy: 96, r: 14 },
      coreByPhase: [{ oy: 96 }, { oy: 12 }, { oy: -28 }],
      bodyHurt: 0.55, coreHurt: 2.2,
      platforms: [
        { x: 0, y: 300, w: 104, h: 20, floor: true },
        { x: 16, y: 254, w: 58, h: 8 },
        { x: 8, y: 211, w: 46, h: 8 },
        { x: 36, y: 171, w: 42, h: 8 },
      ],
      phases: [
        { until: 0.66, steps: [
          { kind: 'drop', dur: 2.0, warn: 0.3, shots: 3, every: 0.5, speed: 100 },
          { kind: 'wait', dur: 0.4 },
          { kind: 'arc', dur: 1.7, warn: 0.4, shots: 2, every: 0.5, speed: 74 },
        ]},
        { until: 0.33, steps: [
          { kind: 'laser', dur: 2.0, warn: 0.48, from: -0.4, to: 0.7, width: 8, eyes: [0] },
          { kind: 'drop', dur: 1.8, warn: 0.28, shots: 4, every: 0.38, speed: 120 },
        ]},
        { until: 0, steps: [
          { kind: 'bar', dur: 1.9, warn: 0.42, fromY: 280, toY: 150, height: 8 },
          { kind: 'home', dur: 1.5, warn: 0.34, shots: 2, every: 0.48, speed: 34, turn: 1.25 },
          { kind: 'arc', dur: 1.5, warn: 0.34, shots: 3, every: 0.36, speed: 90 },
        ]},
      ],
    },
    {
      id: 'leuchte', name: en ? 'LAMP' : 'LEUCHT', bar: en ? 'LAMP' : 'LEUCHT',
      pal: 'green', kind: 'leuchte', hp: 190,
      x: 148, y: 200, hw: 30, hh: 100,
      eyes: [eye(0, -50), eye(-4, -24)],
      core: { ox: -12, oy: 88, r: 14 },
      coreByPhase: [{ oy: 88 }, { oy: 16 }, { oy: -24 }],
      bodyHurt: 0.4, coreHurt: 2.4,
      coreClosedDuring: ['laser', 'bar'],
      platforms: [
        { x: 0, y: 300, w: 110, h: 20, floor: true },
        { x: 18, y: 269, w: 60, h: 8 },
        { x: 6, y: 225, w: 48, h: 8 },
        { x: 40, y: 185, w: 44, h: 8 },
      ],
      phases: [
        { until: 0.66, steps: [
          { kind: 'bar', dur: 2.15, warn: 0.5, fromY: 270, toY: 160, height: 8 },
          { kind: 'arc', dur: 1.6, warn: 0.4, shots: 3, every: 0.4, speed: 80 },
        ]},
        { until: 0.33, steps: [
          { kind: 'laser', dur: 1.9, warn: 0.45, from: -0.2, to: 0.85, width: 8, eyes: [0] },
          { kind: 'shock', dur: 1.4, warn: 0.48, y: 300, band: 14, reach: 110 },
          { kind: 'home', dur: 1.45, warn: 0.34, shots: 2, every: 0.46, speed: 36, turn: 1.4 },
        ]},
        { until: 0, steps: [
          { kind: 'drop', dur: 1.7, warn: 0.28, shots: 4, every: 0.36, speed: 125 },
          { kind: 'bar', dur: 1.7, warn: 0.4, fromY: 150, toY: 290, height: 8 },
          { kind: 'arc', dur: 1.45, warn: 0.32, shots: 4, every: 0.28, speed: 98 },
        ]},
      ],
    },
  ];
}

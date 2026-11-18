// Zahlen-Familie – zusätzliche Linien-Icons (24er-Raster, stroke = currentColor).

const svg = (body, fill = 'none') =>
  `<svg viewBox="0 0 24 24" width="24" height="24" fill="${fill}" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const NI = {
  bulb: svg('<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>'),
  plusRows: svg('<rect x="3.5" y="4" width="17" height="6" rx="2"/><path d="M12 13.5v7M8.5 17h7"/>'),
  refresh: svg('<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>'),
  undo: svg('<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  eraser: svg('<path d="M14.5 4.5l5 5-9 9H6l-2.5-2.5a1.5 1.5 0 0 1 0-2.1z"/><path d="M9.5 9.5l5 5M10.5 18.5H20"/>'),
  circle: svg('<circle cx="12" cy="12" r="7.5"/>'),
  pencil: svg('<path d="M4 20l1-4.5L15.5 5a2.1 2.1 0 0 1 3 3L8 18.5z"/><path d="M13.5 7l3 3"/>'),
  clock: svg('<circle cx="12" cy="13" r="7.5"/><path d="M12 9v4.2l2.6 1.6M9.5 2.8h5"/>'),
  heart: svg('<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z"/>', 'currentColor'),
  heartOff: svg('<path d="M12 20s-7.5-4.6-9.2-9.3C1.7 7.5 3.8 4.5 7 4.5c2 0 3.6 1.1 5 3 1.4-1.9 3-3 5-3 3.2 0 5.3 3 4.2 6.2C19.5 15.4 12 20 12 20z"/>'),
  star: svg('<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>', 'currentColor'),
  trophy: svg('<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>'),
  flag: svg('<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>'),
  grid: svg('<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>'),
  path: svg('<circle cx="6" cy="6" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="7" cy="18" r="2"/><path d="M8 6.8l8 4.4M16 13l-7 4.2"/>'),
  close: svg('<path d="M6 6l12 12M18 6L6 18"/>'),
  check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
  wand: svg('<path d="M4 20L14.5 9.5"/><path d="M13 8l3 3"/><path d="M17 3v3M15.5 4.5h3M20 9v2.5M18.75 10.25h2.5M9.5 3.5v2M8.5 4.5h2"/>'),
  calc: svg('<rect x="5" y="3.5" width="14" height="17" rx="3"/><path d="M8.5 8h7M9 13h.01M12 13h.01M15 13h.01M9 16.5h.01M12 16.5h.01M15 16.5h.01"/>'),
};

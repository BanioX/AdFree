// Gemeinsame Kamera-Grundeinstellung (Spiel, Startbildschirm, Anleitung).
import { qMul, qAxisAngle, qNorm } from './math.js';

/** Schöne 3/4-Ansicht: oben, links (+Z) und rechts (+X) sichtbar. */
export const Q_DEFAULT = qNorm(qMul(qAxisAngle([1, 0, 0], 0.5), qAxisAngle([0, 1, 0], -0.68)));

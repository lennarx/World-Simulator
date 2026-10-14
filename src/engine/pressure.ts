// Presión creciente: el desgaste del poder. Sube cada turno y más rápido con baja aprobación.
// Erosiona aprobación/gobernabilidad (ver politics) y hace más probables los eventos malos (ver events).
import { CFG } from '../data/config';
import type { GameState } from './types';
import { clamp } from './util';

export function stepPressure(s: GameState): void {
  const P = CFG.presion;
  s.presion = clamp(
    s.presion + P.porTurno + Math.max(0, P.umbralDesaprobacion - s.ind.aprobacion) * P.porDesaprobacion,
    0,
    P.max,
  );
}

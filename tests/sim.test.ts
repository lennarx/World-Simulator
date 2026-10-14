import { describe, expect, it } from 'vitest';
import { correrSim } from '../src/sim/run';

describe('sim headless (smoke)', () => {
  it('corre sin NaN, ninguna estrategia gana todo y hay finales variados', () => {
    const filas = correrSim(40);
    expect(filas.every((f) => f.nan === 0)).toBe(true);
    expect(filas.every((f) => f.victorias < f.partidas)).toBe(true);
    const tipos = new Set(filas.flatMap((f) => Object.keys(f.finales)));
    expect(tipos.size).toBeGreaterThanOrEqual(5);
  });
});

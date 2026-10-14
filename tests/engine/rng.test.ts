import { describe, expect, it } from 'vitest';
import { createRng, seedFrom } from '../../src/engine/rng';

describe('rng', () => {
  it('es determinista con la misma semilla', () => {
    const a = createRng(123);
    const b = createRng(123);
    const xs = Array.from({ length: 50 }, () => a.next());
    const ys = Array.from({ length: 50 }, () => b.next());
    expect(xs).toEqual(ys);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
  });
  it('puede retomarse desde su estado', () => {
    const a = createRng(7);
    a.next();
    a.next();
    const b = createRng(a.state());
    expect(b.next()).toBe(a.next());
  });
  it('pickWeighted respeta pesos cero', () => {
    const r = createRng(1);
    for (let i = 0; i < 100; i++) expect(r.pickWeighted(['a', 'b'], (x) => (x === 'a' ? 0 : 1))).toBe('b');
    expect(r.pickWeighted(['a'], () => 0)).toBeNull();
  });
  it('seedFrom acepta texto', () => {
    expect(seedFrom('hola')).toBe(seedFrom('hola'));
    expect(seedFrom('hola')).not.toBe(seedFrom('chau'));
  });
});

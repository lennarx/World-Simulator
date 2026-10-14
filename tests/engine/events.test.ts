import { describe, expect, it } from 'vitest';
import { CFG } from '../../src/data/config';
import { EVENTOS, LEYES } from '../../src/engine';
import { cumple, pesoEvento, resolverVar } from '../../src/engine/events';
import { nuevo } from '../helpers';

describe('eventos', () => {
  it('todos los eventos tienen campos válidos y variables de condición conocidas', () => {
    const s = nuevo();
    for (const e of EVENTOS) {
      expect(e.id).toBeTruthy();
      expect(e.texto.length).toBeGreaterThan(10);
      expect(e.peso).toBeGreaterThan(0);
      for (const c of e.cond) expect(() => resolverVar(s, c.var)).not.toThrow();
      for (const k of Object.keys(e.efectos)) expect(k in s.ind).toBe(true);
      if (e.diplomacia) expect(['vecinoPeor', 'vecinoAleatorio', 'todos']).toContain(e.diplomacia.objetivo);
    }
    for (const l of LEYES) for (const k of Object.keys(l.mods)) expect(k in s.mods).toBe(true);
  });

  it('las condiciones filtran eventos', () => {
    const s = nuevo('peru');
    const corrida = EVENTOS.find((e) => e.id === 'corrida_cambiaria')!;
    s.ind.reservas = 14;
    expect(pesoEvento(s, corrida)).toBe(0);
    s.ind.reservas = 2;
    expect(pesoEvento(s, corrida)).toBeGreaterThan(0);
    expect(cumple(s, { var: 'reservas', op: '<', value: 5 })).toBe(true);
  });

  it('la presión hace más probables los eventos negativos', () => {
    const s = nuevo();
    const malo = EVENTOS.find((e) => e.negativo && e.cond.length === 0)!;
    const w0 = pesoEvento(s, malo);
    s.presion = 80;
    expect(pesoEvento(s, malo)).toBeCloseTo(w0 * (1 + 80 * CFG.eventos.multNegativoPorPresion), 6);
  });

  it('ratio.<area> compara contra el presupuesto base', () => {
    const s = nuevo();
    s.presupuesto.energia = s.presupuestoBase.energia * 0.5;
    expect(resolverVar(s, 'ratio.energia')).toBeCloseTo(0.5, 6);
  });
});

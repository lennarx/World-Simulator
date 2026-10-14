import { describe, expect, it } from 'vitest';
import { getLey, probVotoBloque, votosEsperados } from '../../src/engine';
import { resolverLey } from '../../src/engine/congress';
import { createRng } from '../../src/engine/rng';
import { decisiones, nuevo } from '../helpers';

describe('Congreso', () => {
  it('las concesiones suben la probabilidad de voto', () => {
    const s = nuevo('peru');
    const ley = getLey('reforma_tributaria')!;
    const b = s.congreso.find((x) => x.tipo === 'centro')!;
    expect(probVotoBloque(s, b, ley, 2)).toBeGreaterThan(probVotoBloque(s, b, ley, 0));
  });

  it('el oficialismo apoya más que la oposición', () => {
    const s = nuevo('argentina');
    const ley = getLey('ampliacion_transferencias')!;
    const of = s.congreso.find((x) => x.tipo === 'oficialismo')!;
    const op = s.congreso.find((x) => x.tipo === 'opositor')!;
    expect(probVotoBloque(s, of, ley, 0)).toBeGreaterThan(probVotoBloque(s, op, ley, 0));
  });

  it('Perú (fragmentado) tiene menos votos esperados que Brasil para la misma ley', () => {
    const ley = getLey('reforma_tributaria')!;
    const pe = nuevo('peru');
    const br = nuevo('brasil');
    const r = (s: ReturnType<typeof nuevo>) => {
      const v = votosEsperados(s, ley, {});
      return v.si / v.total;
    };
    expect(r(pe)).toBeLessThan(r(br));
  });

  it('una ley aprobada aplica sus modificadores y no se puede volver a votar', () => {
    const s = nuevo('brasil', 5);
    const rng = createRng(1);
    // Forzamos un Congreso amigo.
    s.congreso.forEach((b) => ((b.afinidad = 100), (b.disciplina = 1)));
    const report: { tag: string; texto: string }[] = [];
    const ok = resolverLey(s, decisiones(s, { ley: 'reforma_tributaria' }), rng, report as never);
    expect(ok).toBe(true);
    expect(s.mods.recaudacion).toBeGreaterThan(0);
    expect(resolverLey(s, decisiones(s, { ley: 'reforma_tributaria' }), rng, report as never)).toBeNull();
  });
});

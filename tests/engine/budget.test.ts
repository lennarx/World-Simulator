import { describe, expect, it } from 'vitest';
import { CFG } from '../../src/data/config';
import { advanceTurn, interesesExigibles, previewFiscal, sanitizarDecisiones } from '../../src/engine';
import { decisiones, nuevo } from '../helpers';

describe('presupuesto', () => {
  it('déficit = gasto + pago de deuda + concesiones - recaudación', () => {
    const s = nuevo('brasil');
    const d = decisiones(s);
    const f = previewFiscal(s, d);
    const gasto = Object.values(d.presupuesto).reduce((a, b) => a + b, 0);
    expect(f.deficit).toBeCloseTo(gasto - d.impuestos, 6);
  });

  it('financiar con emisión sube la inflación más que con deuda', () => {
    const s = nuevo('argentina', 1);
    const gasto = { ...s.presupuesto, asistencia: s.presupuesto.asistencia + 6 };
    const conDeuda = advanceTurn(s, decisiones(s, { presupuesto: gasto, financiamiento: 'deuda' })).state;
    const conEmision = advanceTurn(s, decisiones(s, { presupuesto: gasto, financiamiento: 'emision' })).state;
    expect(conEmision.ind.inflacion).toBeGreaterThan(conDeuda.ind.inflacion);
    expect(conDeuda.ind.deuda).toBeGreaterThan(conEmision.ind.deuda);
  });

  it('pagar menos que los intereses genera atraso y sube la prima', () => {
    const s = nuevo('brasil', 3);
    const p = { ...s.presupuesto, deuda: 0 };
    let x = s;
    for (let i = 0; i < 3; i++) x = advanceTurn(x, decisiones(x, { presupuesto: p })).state;
    expect(x.atraso).toBe(3);
    expect(x.primaRiesgo).toBeGreaterThan(s.primaRiesgo);
  });

  it('el mínimo exigible depende de deuda, tasa y prima', () => {
    const s = nuevo('brasil');
    expect(interesesExigibles(s)).toBeCloseTo((s.ind.deuda * (s.perfil.tasaBase + s.primaRiesgo)) / 100, 6);
  });

  it('sanitiza decisiones inválidas', () => {
    const s = nuevo();
    const d = sanitizarDecisiones({
      ...decisiones(s),
      impuestos: 999,
      presupuesto: { ...s.presupuesto, salud: Number.NaN, educacion: -5 },
      concesiones: { of: 99, ce: -1 },
    });
    expect(d.impuestos).toBe(CFG.fiscal.impuestosMax);
    expect(d.presupuesto.salud).toBe(0);
    expect(d.presupuesto.educacion).toBe(0);
    expect(d.concesiones).toEqual({ of: CFG.congreso.concesionMax });
  });
});

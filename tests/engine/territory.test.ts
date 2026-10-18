import { describe, expect, it } from 'vitest';
import { CFG } from '../../src/data/config';
import { advanceTurn, previewFiscal } from '../../src/engine';
import { createRng } from '../../src/engine/rng';
import {
  aplicarAccionesTerritoriales,
  balanceTerritorial,
  bonusTerritorial,
  legadoTerritorio,
  multPisoDefensa,
  stepTerritorios,
  territorioDe,
  territorioPorGuerra,
  transferir,
} from '../../src/engine/territory';
import { iniciarGuerra, terminarGuerra } from '../../src/engine/war';
import { decisiones, nuevo } from '../helpers';

describe('territorio por guerra', () => {
  it('la victoria contra un vecino deja la franja plena', () => {
    const s = nuevo('argentina');
    iniciarGuerra(s, 'paraguay', false, true, []);
    s.guerra!.avance = 70;
    terminarGuerra(s, 'victoria', []);
    expect(territorioDe(s, 'argentina', 'paraguay')?.profundidad).toBe(1);
    expect(balanceTerritorial(s, 'paraguay')).toBe(1);
  });

  it('la derrota cede una franja propia', () => {
    const s = nuevo('peru');
    territorioPorGuerra(s, 'chile', 'derrota', -70, []);
    expect(territorioDe(s, 'chile', 'peru')?.profundidad).toBe(1);
    expect(balanceTerritorial(s, 'chile')).toBe(-1);
  });

  it('el armisticio congela la línea del frente; el cese impuesto vuelve a las fronteras', () => {
    const s = nuevo('argentina');
    territorioPorGuerra(s, 'chile', 'armisticio', CFG.guerra.umbralVictoria / 2, []);
    expect(territorioDe(s, 'argentina', 'chile')?.profundidad).toBe(0.5);
    const t = nuevo('argentina');
    territorioPorGuerra(t, 'chile', 'cese_impuesto', 50, []);
    expect(t.territorios).toEqual([]);
  });

  it('sin frontera común no se ocupa territorio', () => {
    const s = nuevo('argentina');
    territorioPorGuerra(s, 'venezuela', 'victoria', 70, []);
    expect(s.territorios).toEqual([]);
  });

  it('ganar primero recupera lo propio y después ocupa', () => {
    const s = nuevo('argentina');
    transferir(s, 'chile', 'argentina', 0.6);
    transferir(s, 'argentina', 'chile', 1);
    expect(territorioDe(s, 'chile', 'argentina')).toBeUndefined();
    expect(territorioDe(s, 'argentina', 'chile')?.profundidad).toBe(0.4);
  });
});

describe('efectos de retener territorio', () => {
  it('rinde crecimiento, recaudación y reservas; perderlo resta', () => {
    const s = nuevo('peru');
    transferir(s, 'peru', 'bolivia', 1);
    const b = bonusTerritorial(s);
    expect(b.crecimiento).toBeGreaterThan(0);
    expect(b.recaudacion).toBeGreaterThan(0);
    expect(b.reservas).toBeGreaterThan(0);
    const sin = nuevo('peru');
    expect(previewFiscal(s, decisiones(s)).deficit).toBeLessThan(previewFiscal(sin, decisiones(sin)).deficit);

    const p = nuevo('peru');
    transferir(p, 'bolivia', 'peru', 1);
    expect(bonusTerritorial(p).crecimiento).toBeLessThan(0);
  });

  it('cuesta estabilidad, fija la relación con el ocupado y exige guarnición', () => {
    const s = nuevo('argentina');
    transferir(s, 'argentina', 'paraguay', 1);
    const estab = s.ind.estabilidad;
    stepTerritorios(s, createRng(1), []);
    expect(s.ind.estabilidad).toBeLessThan(estab);
    expect(s.relacionesBase.paraguay).toBe(CFG.guerra.ocupacion.relacionBaseOcupado);
    expect(multPisoDefensa(s)).toBeCloseTo(1 + CFG.guerra.ocupacion.pisoDefensa);
    const r = advanceTurn(s, decisiones(s, { presupuesto: { ...s.presupuesto, defensa: 0 } })).state;
    expect(r.presupuesto.defensa).toBeCloseTo(s.presupuestoBase.defensa * multPisoDefensa(s));
  });

  it('suma soberanía al legado si lo retenés y resta si lo perdiste', () => {
    const s = nuevo('brasil');
    transferir(s, 'brasil', 'surinam', 1);
    expect(legadoTerritorio(s)).toBe(CFG.guerra.ocupacion.soberaniaLegado);
    transferir(s, 'guyana', 'brasil', 1);
    expect(legadoTerritorio(s)).toBe(CFG.guerra.ocupacion.soberaniaLegado + CFG.guerra.ocupacion.perdidoLegado);
  });
});

describe('devolver y reclamar', () => {
  it('devolver termina la ocupación y mejora la relación', () => {
    const s = nuevo('argentina');
    transferir(s, 'argentina', 'uruguay', 1);
    s.relaciones.uruguay = -50;
    aplicarAccionesTerritoriales(s, [{ tipo: 'devolver', con: 'uruguay' }], createRng(1), []);
    expect(territorioDe(s, 'argentina', 'uruguay')).toBeUndefined();
    expect(s.relaciones.uruguay).toBe(-50 + CFG.guerra.devolver.relacion);
  });

  it('reclamar con mala relación no prospera; con buena relación puede salir', () => {
    const s = nuevo('peru');
    transferir(s, 'chile', 'peru', 1);
    s.relaciones.chile = CFG.guerra.reclamar.relacionMin - 10;
    aplicarAccionesTerritoriales(s, [{ tipo: 'reclamar', con: 'chile' }], createRng(1), []);
    expect(territorioDe(s, 'chile', 'peru')).toBeDefined();

    let recuperado = false;
    for (let seed = 1; seed < 60 && !recuperado; seed++) {
      const t = nuevo('peru');
      transferir(t, 'chile', 'peru', 1);
      t.relaciones.chile = 80;
      aplicarAccionesTerritoriales(t, [{ tipo: 'reclamar', con: 'chile' }], createRng(seed), []);
      recuperado = !territorioDe(t, 'chile', 'peru');
    }
    expect(recuperado).toBe(true);
  });

  it('las acciones territoriales pasan la validación del turno', () => {
    const s = nuevo('argentina');
    transferir(s, 'argentina', 'uruguay', 1);
    const r = advanceTurn(s, decisiones(s, { diplomacia: [{ tipo: 'devolver', con: 'uruguay' }] })).state;
    expect(r.territorios).toEqual([]);
  });
});

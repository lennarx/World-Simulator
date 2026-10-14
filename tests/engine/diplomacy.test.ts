import { describe, expect, it } from 'vitest';
import { CFG } from '../../src/data/config';
import { advanceTurn, bonusDiplomatico, otrosPaises, relacionesIniciales } from '../../src/engine';
import { aplicarAcciones, esVecino, puedeFirmar, resolverTratado, sanitizarDiplomacia, stepCrisis, stepRelaciones } from '../../src/engine/diplomacy';
import { createRng } from '../../src/engine/rng';
import type { EntradaParte, GameState } from '../../src/engine/types';
import { ESTRATEGIAS } from '../../src/sim/strategies';
import { decisiones, nuevo } from '../helpers';

const congresoAmigo = (s: GameState) => s.congreso.forEach((b) => ((b.afinidad = 100), (b.disciplina = 1)));

describe('relaciones', () => {
  it('hay relación con los otros 11 países, vecinos primero', () => {
    const r = relacionesIniciales('argentina');
    expect(Object.keys(r)).toHaveLength(11);
    expect(r.argentina).toBeUndefined();
    const lista = otrosPaises('argentina');
    const primerNoVecino = lista.findIndex((p) => !esVecino('argentina', p));
    expect(lista.slice(0, primerNoVecino).every((p) => esVecino('argentina', p))).toBe(true);
  });

  it('una visita mejora la relación con rendimientos decrecientes', () => {
    const s = nuevo('argentina');
    s.relaciones.chile = 0;
    aplicarAcciones(s, [{ tipo: 'visita', con: 'chile' }], []);
    const ganancia1 = s.relaciones.chile!;
    s.relaciones.uruguay = 80;
    aplicarAcciones(s, [{ tipo: 'visita', con: 'uruguay' }], []);
    expect(ganancia1).toBeGreaterThan(s.relaciones.uruguay! - 80);
  });

  it('el gesto público sube aprobación y baja la relación', () => {
    const s = nuevo('peru');
    const { aprobacion } = s.ind;
    const rel = s.relaciones.chile!;
    aplicarAcciones(s, [{ tipo: 'gesto', con: 'chile' }], []);
    expect(s.ind.aprobacion).toBeGreaterThan(aprobacion);
    expect(s.relaciones.chile).toBeLessThan(rel);
  });

  it('las relaciones quedan en -100..100 y derivan hacia la base', () => {
    const s = nuevo('brasil');
    for (let i = 0; i < 30; i++) aplicarAcciones(s, [{ tipo: 'protesta', con: 'venezuela' }], []);
    expect(s.relaciones.venezuela).toBe(-100);
    stepRelaciones(s, { deficit: 0, emision: 0 }, []);
    expect(s.relaciones.venezuela).toBeGreaterThan(-100);
  });

  it('sanitiza acciones inválidas, limita la cantidad y el tratado desplaza a la ley', () => {
    const s = nuevo('argentina');
    const d = sanitizarDiplomacia(s, {
      ...decisiones(s, { ley: 'reforma_tributaria' }),
      diplomacia: [
        { tipo: 'visita', con: 'chile' },
        { tipo: 'visita', con: 'argentina' }, // a uno mismo: inválida
        { tipo: 'visita', con: 'brasil' },
        { tipo: 'gesto', con: 'uruguay' },
      ],
      tratado: { tipo: 'comercio', con: 'brasil' },
    });
    expect(d.diplomacia).toHaveLength(CFG.diplomacia.accionesPorTurno);
    expect(d.diplomacia.every((a) => a.con !== 'argentina')).toBe(true);
    expect(d.ley).toBeNull();
  });
});

describe('tratados', () => {
  it('requieren la relación mínima', () => {
    const s = nuevo('argentina');
    s.relaciones.chile = CFG.diplomacia.tratados.comercio.relacionMin - 1;
    expect(puedeFirmar(s, 'comercio', 'chile').ok).toBe(false);
    s.relaciones.chile = CFG.diplomacia.tratados.comercio.relacionMin;
    expect(puedeFirmar(s, 'comercio', 'chile').ok).toBe(true);
  });

  it('con Congreso a favor se ratifica y da bonus económico con techo', () => {
    const s = nuevo('brasil', 1);
    congresoAmigo(s);
    const socios = Object.keys(s.relaciones);
    for (const con of socios) {
      s.relaciones[con] = 60;
      resolverTratado(s, decisiones(s, { tratado: { tipo: 'comercio', con } }), createRng(1), []);
    }
    expect(s.tratados).toHaveLength(socios.length);
    const b = bonusDiplomatico(s);
    expect(b.crecimiento).toBeCloseTo(CFG.diplomacia.tratados.comercio.topeCrecimiento, 6);
    expect(b.reservas).toBeLessThanOrEqual(CFG.diplomacia.tratados.comercio.topeReservas + 1e-9);
  });

  it('la integración baja la prima una sola vez y castiga si se emite', () => {
    const s = nuevo('argentina', 2);
    congresoAmigo(s);
    s.relaciones.uruguay = 60;
    s.relaciones.paraguay = 60;
    resolverTratado(s, decisiones(s, { tratado: { tipo: 'integracion', con: 'uruguay' } }), createRng(1), []);
    resolverTratado(s, decisiones(s, { tratado: { tipo: 'integracion', con: 'paraguay' } }), createRng(1), []);
    expect(s.mods.prima).toBeCloseTo(CFG.diplomacia.tratados.integracion.prima, 6);
    const antes = s.relaciones.uruguay!;
    const report: EntradaParte[] = [];
    stepRelaciones(s, { deficit: 2, emision: 0.5 }, report);
    expect(s.relaciones.uruguay).toBeLessThan(antes);
    expect(report.some((r) => r.tag === 'DIPLOMACIA')).toBe(true);
  });

  it('el tratado de defensa sube la capacidad militar objetivo', () => {
    const s = nuevo('peru');
    expect(bonusDiplomatico(s).militar).toBe(0);
    s.tratados.push({ tipo: 'defensa', con: 'colombia', desde: 0 });
    s.tratados.push({ tipo: 'defensa', con: 'brasil', desde: 0 });
    expect(bonusDiplomatico(s).militar).toBe(CFG.diplomacia.tratados.defensa.militar); // no se apila
  });
});

describe('crisis de frontera', () => {
  const conCrisis = () => {
    const s = nuevo('peru', 3);
    s.crisis = { con: 'chile', nivel: 1, turnos: 0 };
    s.relaciones.chile = -20;
    return s;
  };

  it('escalar sube el nivel (máx. 3) y negociar lo baja hasta cerrarla', () => {
    const s = conCrisis();
    for (let i = 0; i < 5; i++) stepCrisis(s, 'escalar', createRng(i), []);
    expect(s.crisis?.nivel).toBeLessThanOrEqual(3);
    expect(s.crisisMaxNivel).toBe(3);
    const t = conCrisis();
    stepCrisis(t, 'negociar', createRng(1), []);
    expect(t.crisis).toBeNull();
  });

  it('ignorar mantiene la crisis y cuesta reservas y estabilidad', () => {
    const s = conCrisis();
    const { reservas, estabilidad } = s.ind;
    stepCrisis(s, 'ignorar', createRng(1), []);
    expect(s.crisis).not.toBeNull();
    expect(s.ind.reservas).toBeLessThan(reservas);
    expect(s.ind.estabilidad).toBeLessThan(estabilidad);
  });

  it('una relación muy mala con un vecino termina disparando una crisis', () => {
    const s = nuevo('peru', 4);
    s.relaciones.chile = -60;
    let rng = createRng(9);
    for (let i = 0; i < 40 && !s.crisis; i++) stepCrisis(s, null, rng, []);
    expect(s.crisis?.con).toBe('chile');
    rng = createRng(1);
    const t = nuevo('peru');
    for (const id of Object.keys(t.relaciones)) t.relaciones[id] = 80;
    for (let i = 0; i < 40; i++) stepCrisis(t, null, rng, []);
    expect(t.crisis).toBeNull();
  });
});

describe('integración con el turno', () => {
  it('es determinista con estrategias diplomáticas', () => {
    const jugar = () => {
      let s = nuevo('argentina', 77);
      while (!s.final) s = advanceTurn(s, ESTRATEGIAS.integracionista!(s)).state;
      return s;
    };
    expect(jugar()).toEqual(jugar());
  });
});

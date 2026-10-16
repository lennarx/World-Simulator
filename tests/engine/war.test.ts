import { describe, expect, it } from 'vitest';
import { CFG } from '../../src/data/config';
import { advanceTurn, decisionesActuales } from '../../src/engine';
import { probGolpe, probJuicio } from '../../src/engine/endings';
import { createRng } from '../../src/engine/rng';
import { calcularLegado } from '../../src/engine/score';
import type { EntradaParte, GameState } from '../../src/engine/types';
import {
  frentesDisponibles,
  iniciarGuerra,
  normalizarEsfuerzo,
  resolverDeclaracion,
  stepAtaqueEnemigo,
  stepGuerra,
  stepSanciones,
  terminarGuerra,
} from '../../src/engine/war';
import { ESTRATEGIAS } from '../../src/sim/strategies';
import { decisiones, nuevo } from '../helpers';

const congreso = (s: GameState, afinidad: number) => s.congreso.forEach((b) => ((b.afinidad = afinidad), (b.disciplina = 1)));
const enGuerra = (pais = 'argentina', contra = 'chile', seed = 1) => {
  const s = nuevo(pais, seed);
  iniciarGuerra(s, contra, false, true, []);
  s.turno += 1; // el turno de declaración no se combate
  return s;
};
const dg = (s: GameState, patch = {}) => ({ ...decisiones(s).guerra, ...patch });

describe('frentes y esfuerzo', () => {
  it('los frentes dependen de la geografía', () => {
    expect(frentesDisponibles('argentina', 'chile').sort()).toEqual(['aire', 'frontera', 'mar']);
    expect(frentesDisponibles('argentina', 'bolivia').sort()).toEqual(['aire', 'frontera']); // Bolivia sin costa
    expect(frentesDisponibles('argentina', 'colombia').sort()).toEqual(['aire', 'mar']); // no son vecinos
    expect(frentesDisponibles('peru', 'paraguay')).toEqual(['aire']); // ni vecinos ni costa compartida
  });

  it('el esfuerzo se normaliza a 100 y anula frentes inexistentes', () => {
    const e = normalizarEsfuerzo({ aire: 50, mar: 50, frontera: 0, economia: 0, diplomacia: 0 }, ['aire', 'frontera']);
    expect(e.mar).toBe(0);
    expect(e.aire).toBeCloseTo(100, 6);
    const vacio = normalizarEsfuerzo({ aire: 0, mar: 0, frontera: 0, economia: 0, diplomacia: 0 }, ['aire']);
    expect(Object.values(vacio).reduce((a, b) => a + b, 0)).toBeCloseTo(100, 6);
    expect(Object.values(normalizarEsfuerzo({ aire: Number.NaN }, ['aire'])).every(Number.isFinite)).toBe(true);
  });
});

describe('declarar la guerra', () => {
  it('cuesta: relación -100, terceros enojados, tratados suspendidos, reservas y prima', () => {
    const s = nuevo('argentina', 2);
    s.tratados.push({ tipo: 'comercio', con: 'chile', desde: 0 });
    const { reservas } = s.ind;
    const prima = s.primaRiesgo;
    const relUruguay = s.relaciones.uruguay!;
    iniciarGuerra(s, 'chile', false, true, []);
    expect(s.relaciones.chile).toBe(-100);
    expect(s.relaciones.uruguay).toBeLessThan(relUruguay);
    expect(s.tratados.some((t) => t.con === 'chile')).toBe(false);
    expect(s.ind.reservas).toBeLessThan(reservas);
    expect(s.primaRiesgo).toBeGreaterThan(prima);
    expect(s.guerra?.contra).toBe('chile');
  });

  it('con Congreso hostil: desistir no arranca la guerra; avanzar por decreto sí, sin autorización', () => {
    const a = nuevo('peru', 3);
    congreso(a, -100);
    expect(resolverDeclaracion(a, decisiones(a, { guerra: dg(a, { declarar: 'chile' }) }), createRng(1), [])).toBe(false);
    expect(a.guerra).toBeUndefined();
    const b = nuevo('peru', 3);
    congreso(b, -100);
    const gob = b.ind.gobernabilidad;
    expect(resolverDeclaracion(b, decisiones(b, { guerra: dg(b, { declarar: 'chile', siRechaza: 'avanzar' }) }), createRng(1), [])).toBe(true);
    expect(b.guerra?.autorizada).toBe(false);
    expect(b.ind.gobernabilidad).toBeLessThan(gob);
  });

  it('la guerra sin autorización habilita el juicio político con Congreso hostil', () => {
    const s = nuevo('peru', 4);
    congreso(s, -80);
    expect(probJuicio(s)).toBe(0);
    iniciarGuerra(s, 'chile', false, false, []);
    expect(probJuicio(s)).toBeGreaterThan(0);
  });

  it('en guerra el motor fuerza el piso de gasto en defensa', () => {
    let s = nuevo('argentina', 5);
    iniciarGuerra(s, 'chile', false, true, []);
    s = advanceTurn(s, decisionesActuales(s)).state;
    expect(s.presupuesto.defensa).toBeGreaterThanOrEqual(s.presupuestoBase.defensa * CFG.guerra.multDefensaGuerra - 1e-9);
  });

  it('declarar ocupa la votación: la ley del turno no se vota', () => {
    const s = nuevo('brasil', 6);
    congreso(s, 100);
    const r = advanceTurn(s, decisiones(s, { ley: 'reforma_tributaria', guerra: dg(s, { declarar: 'venezuela' }) }));
    expect(r.state.leyesAprobadas).not.toContain('reforma_tributaria');
    expect(r.state.guerra?.contra).toBe('venezuela');
  });
});

describe('turno de guerra', () => {
  it('cuesta crecimiento, estabilidad y suma costo humano y presión', () => {
    const s = enGuerra();
    const { estabilidad } = s.ind;
    const presion = s.guerra!.presion;
    stepGuerra(s, dg(s), createRng(1), []);
    expect(s.ind.estabilidad).toBeLessThan(estabilidad);
    expect(s.guerra!.costoHumano).toBeGreaterThan(0);
    expect(s.guerra!.presion).toBeGreaterThan(presion);
  });

  it('el parte de guerra no usa humor: todas las entradas tienen tag GUERRA o CONGRESO/GOBIERNO', () => {
    const s = enGuerra();
    const report: EntradaParte[] = [];
    stepGuerra(s, dg(s), createRng(2), report);
    expect(report.every((r) => r.tag === 'GUERRA')).toBe(true);
  });

  it('la presión internacional llega a 100 e impone el cese del fuego', () => {
    const s = enGuerra();
    s.guerra!.presion = 99;
    s.guerra!.avance = 0;
    s.guerra!.capacidadEnemiga = s.ind.capacidadMilitar; // que nadie gane de golpe
    stepGuerra(s, dg(s, { esfuerzo: { aire: 0, mar: 0, frontera: 0, economia: 100, diplomacia: 0 } }), createRng(3), []);
    expect(s.guerra).toBeUndefined();
    expect(s.guerrasPasadas.at(-1)?.resultado).toMatch(/cese_impuesto|derrota/);
  });

  it('avance >= umbral es victoria; <= -umbral es derrota (y sube el riesgo de golpe)', () => {
    const a = enGuerra();
    terminarGuerra(a, 'victoria', []);
    expect(a.guerrasPasadas[0]?.resultado).toBe('victoria');
    const b = enGuerra();
    b.guerra!.avance = -CFG.guerra.umbralVictoria + 1;
    b.guerra!.capacidadEnemiga = 100;
    b.ind.capacidadMilitar = 1;
    stepGuerra(b, dg(b), createRng(4), []);
    expect(b.guerrasPasadas[0]?.resultado).toBe('derrota');
    b.ind.estabilidad = 5;
    b.ind.gobernabilidad = 5;
    const conDerrota = probGolpe(b);
    b.guerrasPasadas = [];
    expect(conDerrota).toBeGreaterThan(probGolpe(b));
  });

  it('el armisticio es más probable con diplomacia y presión', () => {
    let aceptados = 0;
    for (let i = 0; i < 200; i++) {
      const s = enGuerra('argentina', 'chile', i);
      s.guerra!.presion = 80;
      stepGuerra(s, dg(s, { armisticio: true, esfuerzo: { aire: 10, mar: 0, frontera: 0, economia: 0, diplomacia: 90 } }), createRng(i), []);
      if (s.guerrasPasadas.at(-1)?.resultado === 'armisticio') aceptados++;
    }
    expect(aceptados).toBeGreaterThan(50);
  });

  it('la relación con el ex enemigo queda dañada y el legado lo registra', () => {
    const s = enGuerra();
    terminarGuerra(s, 'derrota', []);
    expect(s.relacionesBase.chile).toBe(CFG.guerra.relacionBasePosguerra);
    expect(calcularLegado(s, false).guerra).toBeLessThan(0);
  });
});

describe('ataque enemigo y sanciones', () => {
  it('una crisis en nivel 3 puede terminar en guerra defensiva autorizada', () => {
    let atacado = false;
    for (let i = 0; i < 50 && !atacado; i++) {
      const s = nuevo('peru', i);
      s.crisis = { con: 'chile', nivel: 3, turnos: 2 };
      stepAtaqueEnemigo(s, createRng(i), []);
      if (s.guerra) {
        atacado = true;
        expect(s.guerra.defensiva).toBe(true);
        expect(s.guerra.autorizada).toBe(true);
        expect(s.crisis).toBeNull();
      }
    }
    expect(atacado).toBe(true);
  });

  it('las sanciones drenan reservas y vencen (no corren durante la guerra)', () => {
    const s = nuevo('argentina');
    s.sanciones.push({ motivo: 'test', turnosRestantes: 2 });
    const { reservas } = s.ind;
    stepSanciones(s, []);
    expect(s.ind.reservas).toBeLessThan(reservas);
    stepSanciones(s, []);
    expect(s.sanciones).toHaveLength(0);
  });
});

describe('integración', () => {
  it('la estrategia belicista juega partidas deterministas y sin NaN', () => {
    const jugar = (seed: number) => {
      let s = nuevo('brasil', seed);
      while (!s.final) s = advanceTurn(s, ESTRATEGIAS.belicista!(s)).state;
      return s;
    };
    const a = jugar(11);
    expect(a).toEqual(jugar(11));
    expect(a.guerrasPasadas.length + (a.guerra ? 1 : 0)).toBeGreaterThan(0);
    for (const v of Object.values(a.ind)) expect(Number.isFinite(v)).toBe(true);
  });
});

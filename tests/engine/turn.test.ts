import { describe, expect, it } from 'vitest';
import { CFG } from '../../src/data/config';
import { PAISES_JUGABLES } from '../../src/data/countries';
import { advanceTurn, createGame, decisionesActuales, type GameState } from '../../src/engine';
import { checkEnding, probGolpe, probJuicio } from '../../src/engine/endings';
import { createRng } from '../../src/engine/rng';
import { calcularLegado } from '../../src/engine/score';
import { ESTRATEGIAS } from '../../src/sim/strategies';
import { nuevo } from '../helpers';

const jugar = (s: GameState, est = decisionesActuales) => {
  const reports = [];
  while (!s.final) {
    const r = advanceTurn(s, est(s));
    reports.push(r.report);
    s = r.state;
  }
  return { s, reports };
};

describe('turno', () => {
  it('no muta el estado de entrada', () => {
    const s = nuevo();
    const copia = structuredClone(s);
    advanceTurn(s, decisionesActuales(s));
    expect(s).toEqual(copia);
  });

  it('misma semilla + mismas decisiones = misma partida', () => {
    const a = jugar(nuevo('brasil', 99), ESTRATEGIAS.equilibrada).s;
    const b = jugar(nuevo('brasil', 99), ESTRATEGIAS.equilibrada).s;
    expect(a).toEqual(b);
  });

  it('un mandato dura como mucho 16 turnos y siempre termina con un final', () => {
    for (const p of PAISES_JUGABLES) {
      for (let seed = 0; seed < 10; seed++) {
        const { s } = jugar(createGame(p, seed));
        expect(s.final).not.toBeNull();
        expect(s.turno).toBeLessThanOrEqual(CFG.turnosMandato);
      }
    }
  });

  it('cada turno genera un parte con etiquetas', () => {
    const s = nuevo('argentina', 2);
    const { reports } = jugar(s, ESTRATEGIAS.populista);
    expect(reports.flat().length).toBeGreaterThan(0);
    expect(reports.flat().every((r) => typeof r.tag === 'string' && r.texto.length > 0)).toBe(true);
  });

  it('no produce NaN con ninguna estrategia', () => {
    for (const p of PAISES_JUGABLES)
      for (const est of Object.values(ESTRATEGIAS))
        for (let seed = 0; seed < 5; seed++) {
          const { s } = jugar(createGame(p, seed), est);
          for (const v of Object.values(s.ind)) expect(Number.isFinite(v)).toBe(true);
          expect(Number.isFinite(s.final!.legado.total)).toBe(true);
        }
  });

  it('la partida terminada no avanza más', () => {
    const { s } = jugar(nuevo());
    expect(advanceTurn(s, decisionesActuales(s)).state).toBe(s);
  });
});

describe('finales y legado', () => {
  it('inflación descontrolada => colapso económico', () => {
    const s = nuevo();
    s.ind.inflacion = CFG.finales.inflacionColapso + 1;
    expect(checkEnding(s, createRng(1), [])?.tipo).toBe('colapso_economico');
  });

  it('gobernabilidad crítica sostenida => crisis de gobernabilidad', () => {
    const s = nuevo();
    s.ind.gobernabilidad = 5;
    s.turnosGobBaja = CFG.finales.turnosGobCritica - 1;
    expect(checkEnding(s, createRng(1), [])?.tipo).toBe('crisis_gobernabilidad');
  });

  it('sin escándalo no hay juicio político; con escándalo y Congreso hostil sí puede', () => {
    const s = nuevo('peru');
    s.congreso.forEach((b) => (b.afinidad = -80));
    expect(probJuicio(s)).toBe(0);
    s.escandaloActivo = 2;
    expect(probJuicio(s)).toBeGreaterThan(0);
  });

  it('golpe solo con estabilidad y gobernabilidad muy bajas; menos capacidad militar = más riesgo', () => {
    const s = nuevo();
    expect(probGolpe(s)).toBe(0);
    s.ind.estabilidad = 5;
    s.ind.gobernabilidad = 5;
    s.ind.capacidadMilitar = 80;
    const alta = probGolpe(s);
    s.ind.capacidadMilitar = 10;
    expect(probGolpe(s)).toBeGreaterThan(alta);
  });

  it('el legado suma componentes ponderados + bonus de reelección', () => {
    const s = nuevo();
    const sin = calcularLegado(s, false);
    const con = calcularLegado(s, true);
    expect(con.total - sin.total).toBe(CFG.legado.bonusReeleccion);
    for (const k of ['crecimiento', 'estabilidad', 'bienestar', 'soberania', 'aprobacion'] as const) {
      expect(sin[k]).toBeGreaterThanOrEqual(0);
      expect(sin[k]).toBeLessThanOrEqual(100);
    }
  });

  it('el gasto en defensa mueve la capacidad militar (gancho Fase 3)', () => {
    let s = nuevo('brasil', 4);
    const p = { ...s.presupuesto, defensa: s.presupuesto.defensa * 2 };
    for (let i = 0; i < 6; i++) s = advanceTurn(s, { ...decisionesActuales(s), presupuesto: p }).state;
    expect(s.ind.capacidadMilitar).toBeGreaterThan(s.inicial.capacidadMilitar);
  });
});

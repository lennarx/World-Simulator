import { seedFrom } from './rng';
import type { DatosPais, GameState, Mods } from './types';
import { relacionesIniciales } from './diplomacy';
import { primaObjetivo } from './economy';

export const STATE_VERSION = 4;

export const MODS_VACIOS: Mods = { recaudacion: 0, potencial: 0, prima: 0, riesgoEscandalo: 0, inercia: 0, rigidez: 0 };

export function createGame(pais: DatosPais, semilla: number | string): GameState {
  const seed = seedFrom(semilla);
  const ind = { ...pais.indicadores };
  const base: GameState = {
    version: STATE_VERSION,
    paisId: pais.id,
    semilla: seed,
    rng: seed,
    turno: 0,
    ind,
    inicial: { ...ind },
    presupuestoBase: { ...pais.presupuesto },
    presupuesto: { ...pais.presupuesto },
    impuestos: pais.impuestos,
    impuestosBase: pais.impuestos,
    financiamiento: pais.financiamientoInicial,
    perfil: { ...pais.perfil },
    congreso: pais.congreso.map((b) => ({ ...b, afinidadBase: b.afinidad })),
    eventMult: { ...(pais.eventMult ?? {}) },
    mods: { ...MODS_VACIOS },
    temporales: [],
    capital: 0,
    primaRiesgo: 0,
    atraso: 0,
    presion: 0,
    escandaloActivo: 0,
    turnosGobBaja: 0,
    leyesAprobadas: [],
    historial: [],
    final: null,
    relaciones: relacionesIniciales(pais.id),
    relacionesBase: relacionesIniciales(pais.id),
    tratados: [],
    crisis: null,
    crisisMaxNivel: 0,
    guerrasPasadas: [],
    sanciones: [],
    territorios: [],
  };
  base.primaRiesgo = primaObjetivo(base);
  base.historial.push({ turno: 0, ind: { ...ind }, deficit: 0 });
  return base;
}

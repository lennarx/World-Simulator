// Presupuesto y financiamiento del déficit.
// Convención: todo en % del PBI ANUAL. Un turno es un trimestre, así que los flujos
// que impactan stocks (deuda, emisión) se dividen por CFG.trimestresPorAnio.
import { CFG } from '../data/config';
import { AREAS, type Decisiones, type GameState, type Presupuesto } from './types';
import { clamp } from './util';

export interface ResultadoFiscal {
  recaudacion: number;
  gastoPrimario: number; // todo menos servicio de deuda
  pagoDeuda: number;
  intereses: number; // mínimo exigible
  concesiones: number; // costo fiscal de las concesiones de este turno
  deficit: number; // anualizado (positivo = déficit)
  emision: number; // % PBI emitido ESTE trimestre
  deltaDeuda: number; // cambio de deuda/PBI de este trimestre (antes de licuación)
  enAtraso: boolean;
}

const QUARTER = CFG.trimestresPorAnio;

export function interesesExigibles(state: GameState): number {
  return (state.ind.deuda * (state.perfil.tasaBase + state.primaRiesgo)) / 100;
}

export function recaudacionEfectiva(state: GameState, impuestos: number): number {
  return Math.max(0, impuestos + state.mods.recaudacion);
}

export function costoConcesiones(state: GameState, concesiones: Record<string, number>): number {
  const puntos = Object.values(concesiones).reduce((a, b) => a + Math.max(0, b), 0);
  return puntos * CFG.congreso.costoConcesion * state.perfil.costoConcesion;
}

export function parteDeuda(f: Decisiones['financiamiento']): number {
  return f === 'deuda' ? 1 : f === 'emision' ? 0 : CFG.fiscal.mixtoParteDeuda;
}

/** Normaliza decisiones del jugador/estrategia a rangos válidos (nunca confiar en la UI). */
export function sanitizarDecisiones(d: Decisiones): Decisiones {
  const presupuesto = {} as Presupuesto;
  for (const a of AREAS) {
    const v = Number(d.presupuesto[a]);
    presupuesto[a] = clamp(Number.isFinite(v) ? v : 0, 0, CFG.fiscal.areaMax);
  }
  const imp = Number(d.impuestos);
  const concesiones: Record<string, number> = {};
  for (const [k, v] of Object.entries(d.concesiones ?? {})) {
    const n = Math.round(Number(v));
    if (Number.isFinite(n) && n > 0) concesiones[k] = clamp(n, 0, CFG.congreso.concesionMax);
  }
  return {
    presupuesto,
    impuestos: clamp(Number.isFinite(imp) ? imp : CFG.fiscal.impuestosMin, CFG.fiscal.impuestosMin, CFG.fiscal.impuestosMax),
    financiamiento: d.financiamiento === 'emision' || d.financiamiento === 'mixto' ? d.financiamiento : 'deuda',
    ley: d.ley ?? null,
    concesiones,
    // La parte diplomática se valida contra el estado en diplomacy.sanitizarDiplomacia.
    diplomacia: d.diplomacia ?? [],
    tratado: d.tratado ?? null,
    respuestaCrisis: d.respuestaCrisis ?? null,
  };
}

/** Cálculo puro (sin efectos) — la UI lo usa para mostrar el déficit en vivo. */
export function previewFiscal(state: GameState, d: Decisiones): ResultadoFiscal {
  const p = d.presupuesto;
  const gastoPrimario = AREAS.filter((a) => a !== 'deuda').reduce((acc, a) => acc + p[a], 0);
  const intereses = interesesExigibles(state);
  const pagoDeuda = p.deuda;
  const concesiones = costoConcesiones(state, d.concesiones);
  const recaudacion = recaudacionEfectiva(state, d.impuestos);
  const deficit = gastoPrimario + pagoDeuda + concesiones - recaudacion;

  const necesidad = deficit / QUARTER;
  let deltaDeuda = 0;
  let emision = 0;
  if (necesidad > 0) {
    const fd = parteDeuda(d.financiamiento);
    deltaDeuda += necesidad * fd;
    emision = necesidad * (1 - fd);
  } else {
    deltaDeuda += necesidad; // superávit: rescata deuda
  }
  // Intereses impagos se capitalizan (y además suben la prima, ver economy).
  if (pagoDeuda < intereses) deltaDeuda += (intereses - pagoDeuda) / QUARTER;
  // Lo pagado por encima de los intereses ya está dentro del déficit: amortiza.
  else deltaDeuda -= (pagoDeuda - intereses) / QUARTER;

  return {
    recaudacion,
    gastoPrimario,
    pagoDeuda,
    intereses,
    concesiones,
    deficit,
    emision,
    deltaDeuda,
    enAtraso: pagoDeuda + 1e-9 < intereses,
  };
}

export function applyBudget(state: GameState, d: Decisiones): ResultadoFiscal {
  const r = previewFiscal(state, d);
  state.presupuesto = { ...d.presupuesto };
  state.impuestos = d.impuestos;
  state.financiamiento = d.financiamiento;
  state.ind.deuda = clamp(state.ind.deuda + r.deltaDeuda, 0, CFG.economia.deudaMax);
  state.atraso = r.enAtraso ? state.atraso + 1 : 0;
  return r;
}

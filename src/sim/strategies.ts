// Estrategias fijas para la simulación headless. Son "jugadores" deterministas (dado el estado).
import { CFG } from '../data/config';
import { getLey } from '../engine/data';
import { previewFiscal, interesesExigibles } from '../engine/budget';
import { votosEsperados } from '../engine/congress';
import { pesoComercial, peorVecino, puedeFirmar, tieneTratado, votosTratado } from '../engine/diplomacy';
import type { AccionDiplomatica, Decisiones, GameState, Presupuesto, TipoTratado } from '../engine/types';
import { decisionesActuales } from '../engine/turn';

export type Estrategia = (s: GameState) => Decisiones;

const escalar = (p: Presupuesto, f: Partial<Record<keyof Presupuesto, number>>): Presupuesto => {
  const out = { ...p };
  for (const [k, v] of Object.entries(f)) out[k as keyof Presupuesto] = p[k as keyof Presupuesto] * (v ?? 1);
  return out;
};

/** Elige la primera ley de la lista que no esté aprobada y que tenga chances razonables (con concesiones si hace falta). */
function elegirLey(s: GameState, preferidas: string[], umbral: number, maxConcesion: number): Pick<Decisiones, 'ley' | 'concesiones'> {
  for (const id of preferidas) {
    if (s.leyesAprobadas.includes(id)) continue;
    const ley = getLey(id);
    if (!ley) continue;
    // Prueba sin concesiones y después repartiendo a centro/regionales.
    for (let c = 0; c <= maxConcesion; c++) {
      const concesiones: Record<string, number> = {};
      if (c > 0) for (const b of s.congreso) if (b.tipo === 'centro' || b.tipo === 'regional') concesiones[b.id] = c;
      const { si, total } = votosEsperados(s, ley, concesiones);
      if (si / total >= umbral) return { ley: id, concesiones };
    }
  }
  return { ley: null, concesiones: {} };
}

// ---------------------------------------------------------------- Diplomacia de las estrategias

/** Busca un tratado firmable con chances en el Congreso (socios ordenados por peso comercial). */
function elegirTratado(s: GameState, tipos: TipoTratado[], umbral: number): Decisiones['tratado'] {
  const socios = Object.keys(s.relaciones).sort((a, b) => pesoComercial(b) - pesoComercial(a));
  for (const tipo of tipos)
    for (const con of socios) {
      if (!puedeFirmar(s, tipo, con).ok) continue;
      const v = votosTratado(s, tipo, {});
      if (v.si / v.total >= umbral) return { tipo, con };
    }
  return null;
}

/** Visitas a quien más lo necesita: el peor vecino y el socio comercial grande todavía sin tratado. */
function visitas(s: GameState, n: number): AccionDiplomatica[] {
  const out: AccionDiplomatica[] = [];
  const peor = peorVecino(s);
  if (peor && s.relaciones[peor]! < 40) out.push({ tipo: 'visita', con: peor });
  const socio = Object.keys(s.relaciones)
    .filter((id) => !tieneTratado(s, 'comercio', id) && !out.some((a) => a.con === id))
    .sort((a, b) => pesoComercial(b) - pesoComercial(a))[0];
  if (socio) out.push({ tipo: 'visita', con: socio });
  return out.slice(0, n);
}

/** No hacer nada: presupuesto base para siempre, sin leyes. */
export const nada: Estrategia = (s) => decisionesActuales(s);

/** Equilibrada: paga intereses, apunta a déficit chico, invierte algo, negocia leyes razonables. */
export const equilibrada: Estrategia = (s) => {
  const base = s.presupuestoBase;
  const p = escalar(base, { infraestructura: 1.25, educacion: 1.1, salud: 1.05, seguridad: 1.1, energia: 1.05 });
  p.deuda = Math.min(CFG.fiscal.areaMax, interesesExigibles(s) + 0.2);
  const d: Decisiones = { presupuesto: p, impuestos: s.impuestosBase, financiamiento: 'deuda', ley: null, concesiones: {}, diplomacia: [], tratado: null, respuestaCrisis: null };
  // Si el déficit es alto, recorta asistencia/energía un poco y sube impuestos de a poco.
  let f = previewFiscal(s, d);
  if (f.deficit > 2.5) {
    d.impuestos = Math.min(CFG.fiscal.impuestosMax, s.impuestosBase + Math.min(1.5, (f.deficit - 2.5) / 2));
    d.presupuesto.energia *= 0.9;
    f = previewFiscal(s, d);
  }
  // Con deuda muy alta, mixto para no espiralizar la prima; con inflación alta, nunca emitir.
  d.financiamiento = s.ind.deuda > 100 && s.ind.inflacion < 15 ? 'mixto' : 'deuda';
  const leyes = ['regla_fiscal', 'ley_inversiones', 'ley_integridad', 'autonomia_bc', 'reforma_tributaria'];
  Object.assign(d, elegirLey(s, leyes, 0.58, 1));
  // Diplomacia: visita al peor vecino / socio comercial; tratado de comercio cuando no hay ley; negocia crisis.
  d.diplomacia = visitas(s, 1);
  if (!d.ley) d.tratado = elegirTratado(s, ['comercio'], 0.58);
  d.respuestaCrisis = s.crisis ? 'negociar' : null;
  return d;
};

/** Populista: más asistencia, subsidios, baja impuestos y emite. */
export const populista: Estrategia = (s) => {
  const p = escalar(s.presupuestoBase, { asistencia: 1.35, energia: 1.4, salud: 1.15, seguridad: 1.1 });
  const d: Decisiones = {
    presupuesto: p,
    impuestos: s.impuestosBase - 1.5,
    financiamiento: 'emision',
    ley: null,
    concesiones: {},
    diplomacia: [],
    tratado: null,
    respuestaCrisis: null,
  };
  Object.assign(d, elegirLey(s, ['ampliacion_transferencias', 'emergencia_economica'], 0.5, 2));
  // Diplomacia de tribuna: si la aprobación flaquea, le pega al vecino; ante una crisis, escala.
  const peor = peorVecino(s);
  if (peor && s.ind.aprobacion < 45) d.diplomacia = [{ tipo: 'gesto', con: peor }];
  d.respuestaCrisis = s.crisis ? 'escalar' : null;
  return d;
};

/** Austeridad: recorta fuerte, sube impuestos, sobrepaga deuda e impulsa reformas impopulares. */
export const austeridad: Estrategia = (s) => {
  const p = escalar(s.presupuestoBase, { asistencia: 0.88, energia: 0.75, salud: 0.95, educacion: 0.95, infraestructura: 0.92, defensa: 0.9 });
  p.deuda = Math.min(CFG.fiscal.areaMax, interesesExigibles(s) + 0.5);
  const d: Decisiones = { presupuesto: p, impuestos: s.impuestosBase + 1, financiamiento: 'deuda', ley: null, concesiones: {}, diplomacia: [], tratado: null, respuestaCrisis: null };
  Object.assign(d, elegirLey(s, ['reforma_previsional', 'reforma_laboral', 'regla_fiscal', 'autonomia_bc', 'reforma_tributaria'], 0.52, 2));
  d.diplomacia = visitas(s, 1);
  if (!d.ley) d.tratado = elegirTratado(s, ['comercio', 'integracion'], 0.52);
  d.respuestaCrisis = s.crisis ? 'negociar' : null;
  return d;
};

/** Aislacionista: la misma economía que la equilibrada, pero sin diplomacia (ignora crisis, cero tratados). */
export const aislacionista: Estrategia = (s) => {
  const d = equilibrada(s);
  return { ...d, diplomacia: [], tratado: null, respuestaCrisis: null };
};

/** Integracionista: economía equilibrada sin emisión + prioriza tratados y visitas (2 por turno). */
export const integracionista: Estrategia = (s) => {
  const d = equilibrada(s);
  d.financiamiento = 'deuda';
  d.diplomacia = visitas(s, 2);
  const t = elegirTratado(s, ['comercio', 'integracion', 'defensa'], 0.55);
  if (t) {
    d.tratado = t;
    d.ley = null;
  }
  d.respuestaCrisis = s.crisis ? 'negociar' : null;
  return d;
};

export const ESTRATEGIAS: Record<string, Estrategia> = { equilibrada, populista, austeridad, nada, aislacionista, integracionista };

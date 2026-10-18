// Estrategias fijas para la simulación headless. Son "jugadores" deterministas (dado el estado).
import { CFG } from '../data/config';
import { getLey } from '../engine/data';
import { previewFiscal, interesesExigibles } from '../engine/budget';
import { votosEsperados } from '../engine/congress';
import { pesoComercial, peorVecino, puedeFirmar, tieneTratado, vecinosDe, votosTratado } from '../engine/diplomacy';
import type { AccionDiplomatica, DecisionGuerra, Decisiones, GameState, Presupuesto, TipoTratado } from '../engine/types';
import { capacidadPais, esfuerzoPorDefecto, frentesDisponibles } from '../engine/war';
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

// ---------------------------------------------------------------- Guerra de las estrategias

const sinGuerra = (): DecisionGuerra => ({ declarar: null, siRechaza: 'desistir', esfuerzo: null, armisticio: false });

/** Respuesta por defecto a una guerra (casi siempre defensiva): reparto estándar y armisticio si va mal. */
function guerraPorDefecto(s: GameState, pideArmisticio: (s: GameState) => boolean): DecisionGuerra {
  if (!s.guerra) return sinGuerra();
  return { ...sinGuerra(), esfuerzo: esfuerzoPorDefecto(frentesDisponibles(s.paisId, s.guerra.contra)), armisticio: pideArmisticio(s) };
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
  const d: Decisiones = { presupuesto: p, impuestos: s.impuestosBase, financiamiento: 'deuda', ley: null, concesiones: {}, diplomacia: [], tratado: null, respuestaCrisis: null, guerra: sinGuerra() };
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
  d.guerra = guerraPorDefecto(s, (x) => x.guerra!.avance < 0 || x.guerra!.turnos >= 3);
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
    guerra: sinGuerra(),
  };
  Object.assign(d, elegirLey(s, ['ampliacion_transferencias', 'emergencia_economica'], 0.5, 2));
  // Diplomacia de tribuna: si la aprobación flaquea, le pega al vecino; ante una crisis, escala.
  const peor = peorVecino(s);
  if (peor && s.ind.aprobacion < 45) d.diplomacia = [{ tipo: 'gesto', con: peor }];
  d.respuestaCrisis = s.crisis ? 'escalar' : null;
  d.guerra = guerraPorDefecto(s, () => false); // "no se negocia con el enemigo"
  return d;
};

/** Austeridad: recorta fuerte, sube impuestos, sobrepaga deuda e impulsa reformas impopulares. */
export const austeridad: Estrategia = (s) => {
  const p = escalar(s.presupuestoBase, { asistencia: 0.88, energia: 0.75, salud: 0.95, educacion: 0.95, infraestructura: 0.92, defensa: 0.9 });
  p.deuda = Math.min(CFG.fiscal.areaMax, interesesExigibles(s) + 0.5);
  const d: Decisiones = { presupuesto: p, impuestos: s.impuestosBase + 1, financiamiento: 'deuda', ley: null, concesiones: {}, diplomacia: [], tratado: null, respuestaCrisis: null, guerra: sinGuerra() };
  Object.assign(d, elegirLey(s, ['reforma_previsional', 'reforma_laboral', 'regla_fiscal', 'autonomia_bc', 'reforma_tributaria'], 0.52, 2));
  d.diplomacia = visitas(s, 1);
  if (!d.ley) d.tratado = elegirTratado(s, ['comercio', 'integracion'], 0.52);
  d.respuestaCrisis = s.crisis ? 'negociar' : null;
  d.guerra = guerraPorDefecto(s, () => true); // la guerra es cara: pide armisticio ya
  return d;
};

/** Aislacionista: la misma economía que la equilibrada, pero sin diplomacia (ignora crisis, cero tratados). */
export const aislacionista: Estrategia = (s) => {
  const d = equilibrada(s);
  return { ...d, diplomacia: [], tratado: null, respuestaCrisis: null, guerra: guerraPorDefecto(s, () => false) };
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

/**
 * Belicista: economía equilibrada con más defensa. Elige al vecino más débil (sin tratados con él), escala crisis y
 * declara aunque el Congreso diga que no. En guerra: casi todo al frente; si va ganando, pide armisticio para
 * congelar la línea (territorio). Después de una guerra consolida unos turnos antes de buscar la siguiente.
 */
export const belicista: Estrategia = (s) => {
  const d = equilibrada(s);
  d.presupuesto.defensa = Math.max(d.presupuesto.defensa, s.presupuestoBase.defensa * CFG_BELICISTA.defensa);
  // Las crisis se negocian salvo contra quien se piensa atacar (ahí se escala: suma apoyo en el Congreso).
  d.respuestaCrisis = s.crisis ? 'negociar' : null;
  if (s.guerra) {
    const g = s.guerra;
    const frentes = frentesDisponibles(s.paisId, g.contra);
    const esfuerzo = { aire: 0, mar: 0, frontera: 0, economia: 20, diplomacia: 5 };
    for (const f of frentes) esfuerzo[f] = 75 / frentes.length;
    const asegurar = (g.avance >= CFG_BELICISTA.avanceArmisticio && g.turnos >= 2) || g.presion >= 75 || (g.avance < 0 && g.turnos >= 3);
    d.guerra = { ...sinGuerra(), esfuerzo, armisticio: asegurar };
    return d;
  }
  const ultima = s.guerrasPasadas.at(-1);
  if (ultima && s.turno - ultima.hasta < CFG_BELICISTA.consolidar) return d;
  const propia = s.ind.capacidadMilitar;
  const objetivo = vecinosDe(s.paisId)
    .filter((v) => v in s.relaciones && !s.tratados.some((t) => t.con === v))
    .map((v) => ({ v, margen: propia - capacidadPais(v) }))
    .filter((x) => x.margen >= CFG_BELICISTA.margen)
    .sort((a, b) => b.margen - a.margen)[0];
  if (objetivo && s.crisis?.con === objetivo.v) d.respuestaCrisis = 'escalar';
  if (objetivo) {
    d.guerra = { ...sinGuerra(), declarar: objetivo.v, siRechaza: 'avanzar' };
    d.ley = null;
    d.tratado = null;
  }
  return d;
};

/** Parámetros de la estrategia belicista (son del "jugador", no del balance: no van en CFG). */
const CFG_BELICISTA = { defensa: 1.6, avanceArmisticio: 40, consolidar: 8, margen: 5 };

/** Pacifista: equilibrada, negocia toda crisis y, si la atacan, pide armisticio con mucho esfuerzo diplomático. */
export const pacifista: Estrategia = (s) => {
  const d = equilibrada(s);
  d.respuestaCrisis = s.crisis ? 'negociar' : null;
  if (s.guerra) {
    const frentes = frentesDisponibles(s.paisId, s.guerra.contra);
    const esfuerzo = { aire: 0, mar: 0, frontera: 0, economia: 20, diplomacia: 40 };
    for (const f of frentes) esfuerzo[f] = 40 / frentes.length;
    d.guerra = { ...sinGuerra(), esfuerzo, armisticio: true };
  }
  return d;
};

export const ESTRATEGIAS: Record<string, Estrategia> = {
  equilibrada,
  populista,
  austeridad,
  nada,
  aislacionista,
  integracionista,
  belicista,
  pacifista,
};

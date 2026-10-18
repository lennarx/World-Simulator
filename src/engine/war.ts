// Guerra (Fase 3). Portada del prototipo "Cono Sur": esfuerzo repartido entre aire, mar, frontera,
// economía y diplomacia; presión internacional que fuerza el cese del fuego; finales con desglose.
// Regla de tono: lo militar se narra en serio (ver LINEAS_GUERRA en data/texts.ts).
import { CFG } from '../data/config';
import militarJson from '../data/militar.json';
import { LINEAS_GUERRA, NOMBRE_FRENTE } from '../data/texts';
import { votar, votosEsperados, type Votable } from './congress';
import { esVecino, nombrePais, relacionPromedio, tieneTratado } from './diplomacy';
import { legadoTerritorio, territorioPorGuerra } from './territory';
import type { Rng } from './rng';
import type {
  DecisionGuerra,
  Decisiones,
  DestinoEsfuerzo,
  EntradaParte,
  Esfuerzo,
  EstadoGuerra,
  FrenteMilitar,
  GameState,
  TipoBloque,
  TipoResultadoGuerra,
} from './types';
import { clamp, sigmoid } from './util';

const G = CFG.guerra;
const MIL = militarJson.paises as Record<string, { capacidad: number; mar: boolean }>;

export const FRENTES: FrenteMilitar[] = ['aire', 'mar', 'frontera'];
export const DESTINOS: DestinoEsfuerzo[] = ['aire', 'mar', 'frontera', 'economia', 'diplomacia'];

export const capacidadPais = (id: string): number => MIL[id]?.capacidad ?? 0;

/** Frentes posibles entre dos países: aire siempre; mar si ambos tienen costa; frontera si son vecinos. */
export function frentesDisponibles(a: string, b: string): FrenteMilitar[] {
  const f: FrenteMilitar[] = ['aire'];
  if (MIL[a]?.mar && MIL[b]?.mar) f.push('mar');
  if (esVecino(a, b)) f.push('frontera');
  return f;
}

export const DECISION_GUERRA_VACIA: DecisionGuerra = { declarar: null, siRechaza: 'desistir', esfuerzo: null, armisticio: false };

/** Reparto por defecto: 70% parejo en los frentes disponibles, 20% economía, 10% diplomacia. */
export function esfuerzoPorDefecto(frentes: FrenteMilitar[]): Esfuerzo {
  const e: Esfuerzo = { aire: 0, mar: 0, frontera: 0, economia: 20, diplomacia: 10 };
  for (const f of frentes) e[f] = 70 / frentes.length;
  return e;
}

/** Normaliza a 100, anula frentes inexistentes. Si todo da 0, vuelve al reparto por defecto. */
export function normalizarEsfuerzo(e: Partial<Esfuerzo> | null | undefined, frentes: FrenteMilitar[]): Esfuerzo {
  if (!e) return esfuerzoPorDefecto(frentes);
  const out: Esfuerzo = { aire: 0, mar: 0, frontera: 0, economia: 0, diplomacia: 0 };
  for (const k of DESTINOS) {
    const v = Number(e[k]);
    const valido = Number.isFinite(v) && v > 0 && (!(FRENTES as string[]).includes(k) || frentes.includes(k as FrenteMilitar));
    out[k] = valido ? v : 0;
  }
  const total = DESTINOS.reduce((a, k) => a + out[k], 0);
  if (total <= 0) return esfuerzoPorDefecto(frentes);
  for (const k of DESTINOS) out[k] = (out[k] * 100) / total;
  return out;
}

export function sanitizarGuerra(s: GameState, d: Decisiones): DecisionGuerra {
  const g = d.guerra ?? DECISION_GUERRA_VACIA;
  const declarar = !s.guerra && g.declarar && g.declarar in s.relaciones ? g.declarar : null;
  const frentes = s.guerra ? frentesDisponibles(s.paisId, s.guerra.contra) : [];
  return {
    declarar,
    siRechaza: g.siRechaza === 'avanzar' ? 'avanzar' : 'desistir',
    esfuerzo: s.guerra ? normalizarEsfuerzo(g.esfuerzo, frentes) : null,
    armisticio: !!s.guerra && !!g.armisticio,
  };
}

// ---------------------------------------------------------------- Autorización y declaración

/** Lo que vota el Congreso para autorizar el uso de la fuerza contra `contra`. */
export function votableGuerra(s: GameState, contra: string): Votable {
  const A = G.autorizacion;
  let extra = 0;
  if (s.crisis?.con === contra) extra += A.bonoCrisis;
  if ((s.relaciones[contra] ?? 0) < -50) extra += A.bonoHostil;
  if (s.tratados.some((t) => t.con === contra)) extra -= A.castigoSocio;
  const apoyo = {} as Record<TipoBloque, number>;
  for (const [k, v] of Object.entries(A.apoyo)) apoyo[k as TipoBloque] = v + extra;
  return { apoyo };
}

export const votosAutorizacion = (s: GameState, contra: string, concesiones: Record<string, number> = {}) =>
  votosEsperados(s, votableGuerra(s, contra), concesiones);

/** Arranca el estado de guerra y aplica los costos de entrar (diplomáticos, económicos, rally). */
export function iniciarGuerra(s: GameState, contra: string, defensiva: boolean, autorizada: boolean, report: EntradaParte[]): void {
  const D = G.declarar;
  const nombre = nombrePais(contra);
  report.push({ tag: 'GUERRA', texto: defensiva ? LINEAS_GUERRA.ataque(nombre) : LINEAS_GUERRA.declaracion(nombre) });

  // Diplomacia: el atacado a -100; si agredimos, el resto de la región también nos mira mal.
  s.relaciones[contra] = -100;
  if (!defensiva) {
    for (const id of Object.keys(s.relaciones)) {
      if (id === contra) continue;
      let delta = D.relacionTerceros;
      if (esVecino(contra, id)) delta += D.relacionVecinosAtacado;
      if (tieneTratado(s, 'defensa', id)) delta += D.relacionSociosDefensa;
      s.relaciones[id] = clamp(s.relaciones[id]! + delta, -100, 100);
    }
  }
  // Se suspenden los tratados con el enemigo; la crisis con él queda subsumida por la guerra.
  s.tratados = s.tratados.filter((t) => t.con !== contra);
  if (s.crisis?.con === contra) s.crisis = null;

  s.ind.reservas = Math.max(0, s.ind.reservas + D.reservas);
  s.primaRiesgo += D.prima;
  s.ind.aprobacion = clamp(s.ind.aprobacion + (defensiva ? D.rallyDefensa : D.rallyAgresion), 0, 100);

  if (!defensiva && relacionPromedio(s.relaciones) < 0) {
    s.sanciones.push({ motivo: `agresión a ${nombre}`, turnosRestantes: G.sanciones.duracion });
    report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.sanciones });
  }

  const frentes = frentesDisponibles(s.paisId, contra);
  const g: EstadoGuerra = {
    contra,
    desde: s.turno,
    turnos: 0,
    defensiva,
    autorizada,
    avance: 0,
    presion: G.presion.inicial,
    costoHumano: 0,
    capacidadEnemiga: capacidadPais(contra),
    moral: G.moral.inicial + (defensiva ? G.moral.defensiva : 0),
    ultimoEsfuerzo: esfuerzoPorDefecto(frentes),
    ultimosFrentes: {},
  };
  s.guerra = g;
}

/** Declaración del jugador: ocupa la votación del turno. Devuelve true si la guerra empezó. */
export function resolverDeclaracion(s: GameState, d: Decisiones, rng: Rng, report: EntradaParte[]): boolean {
  const contra = d.guerra.declarar;
  if (!contra || s.guerra) return false;
  const v = votar(s, votableGuerra(s, contra), d.concesiones, rng);
  if (v.aprobada) {
    report.push({ tag: 'CONGRESO', texto: LINEAS_GUERRA.autorizada(v.si, v.total) });
    iniciarGuerra(s, contra, false, true, report);
    return true;
  }
  report.push({ tag: 'CONGRESO', texto: LINEAS_GUERRA.rechazada(v.si, v.total) });
  if (d.guerra.siRechaza === 'avanzar') {
    s.ind.gobernabilidad = clamp(s.ind.gobernabilidad - G.autorizacion.castigoDecreto, 0, 100);
    report.push({ tag: 'GOBIERNO', texto: LINEAS_GUERRA.decreto });
    iniciarGuerra(s, contra, false, false, report);
    return true;
  }
  s.ind.gobernabilidad = clamp(s.ind.gobernabilidad - CFG.congreso.costoFracaso, 0, 100);
  report.push({ tag: 'GOBIERNO', texto: LINEAS_GUERRA.desiste });
  return false;
}

/** Crisis de frontera en nivel 3: el rival puede atacar (guerra defensiva, autorizada de hecho). */
export function stepAtaqueEnemigo(s: GameState, rng: Rng, report: EntradaParte[]): void {
  if (s.guerra || !s.crisis || s.crisis.nivel < 3) return;
  if (rng.chance(G.probAtaqueNivel3)) iniciarGuerra(s, s.crisis.con, true, true, report);
}

// ---------------------------------------------------------------- Turno de guerra

function esfuerzoEnemigo(frentes: FrenteMilitar[], rng: Rng): Record<FrenteMilitar, number> {
  const e: Record<FrenteMilitar, number> = { aire: 0, mar: 0, frontera: 0 };
  const pesos = frentes.map(() => Math.max(0.1, 1 + rng.noise(G.frentes.ruidoEnemigo / 100)));
  const total = pesos.reduce((a, b) => a + b, 0);
  frentes.forEach((f, i) => (e[f] = (G.frentes.esfuerzoEnemigoMilitar * pesos[i]!) / total));
  return e;
}

/** Capacidad propia efectiva: la del país + aliados de defensa si nos atacaron. */
export function capacidadPropia(s: GameState): number {
  const aliados = s.guerra?.defensiva ? s.tratados.filter((t) => t.tipo === 'defensa').length : 0;
  return s.ind.capacidadMilitar + aliados * G.frentes.aporteAliado;
}

export function stepGuerra(s: GameState, dg: DecisionGuerra, rng: Rng, report: EntradaParte[]): void {
  const g = s.guerra;
  if (!g) return;
  // El turno en que empieza la guerra no se combate: la movilización ocupa el trimestre.
  if (g.desde === s.turno) return;
  const F = G.frentes;
  const frentes = frentesDisponibles(s.paisId, g.contra);
  const esf = dg.esfuerzo ?? normalizarEsfuerzo(g.ultimoEsfuerzo, frentes);
  g.ultimoEsfuerzo = esf;
  g.turnos += 1;
  const enemigo = esfuerzoEnemigo(frentes, rng);

  // ---- Frentes
  let perdidos = 0;
  g.ultimosFrentes = {};
  for (const f of frentes) {
    const propio = capacidadPropia(s) * (esf[f] / 100) * (g.moral / 50) * (g.defensiva ? F.bonusDefensa : 1);
    const ajeno = g.capacidadEnemiga * (enemigo[f] / 100) * (!g.defensiva ? F.bonusDefensa : 1);
    const gana = rng.chance(sigmoid((propio - ajeno) / F.escala));
    // Frentes sin esfuerzo propio no se "ganan" de casualidad.
    if (gana && esf[f] > 0) {
      g.avance = clamp(g.avance + F.avance, -100, 100);
      g.capacidadEnemiga = Math.max(0, g.capacidadEnemiga - F.desgastePerdedor);
      s.ind.capacidadMilitar = clamp(s.ind.capacidadMilitar - F.desgasteGanador, 0, 100);
      g.moral = clamp(g.moral + G.moral.porFrente, 0, 100);
      g.ultimosFrentes[f] = 'ganado';
      report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.frenteGanado(NOMBRE_FRENTE[f]) });
    } else {
      g.avance = clamp(g.avance - F.avance, -100, 100);
      s.ind.capacidadMilitar = clamp(s.ind.capacidadMilitar - F.desgastePerdedor, 0, 100);
      g.capacidadEnemiga = Math.max(0, g.capacidadEnemiga - F.desgasteGanador);
      g.moral = clamp(g.moral - G.moral.porFrente, 0, 100);
      g.ultimosFrentes[f] = 'perdido';
      perdidos++;
      report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.frentePerdido(NOMBRE_FRENTE[f]) });
    }
  }
  g.moral = clamp(g.moral + G.moral.porTurno, 0, 100);

  // ---- Costos del turno. El esfuerzo en "economía" sostiene el frente interno.
  const P = G.porTurno;
  const alivio = 1 - (esf.economia / 100) * G.alivioEconomia;
  s.ind.crecimiento += P.crecimiento * alivio;
  s.ind.reservas = Math.max(0, s.ind.reservas + P.reservas * alivio);
  s.ind.estabilidad = clamp(s.ind.estabilidad + P.estabilidad, 0, 100);
  const costo = P.costoHumano + perdidos * P.costoHumanoPorFrentePerdido;
  g.costoHumano = clamp(g.costoHumano + costo, 0, 100);
  s.ind.aprobacion = clamp(s.ind.aprobacion + P.aprobacion + g.costoHumano * P.aprobacionPorCostoHumano, 0, 100);
  report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.costoHumano });

  // ---- Presión internacional. La diplomacia la frena; el costo humano la acelera.
  const PR = G.presion;
  const presionAntes = g.presion;
  g.presion = clamp(
    g.presion + PR.porTurno * (g.defensiva ? PR.multDefensiva : 1) * (1 - (esf.diplomacia / 100) * PR.alivioDiplomacia) + g.costoHumano * PR.porCostoHumano,
    0,
    100,
  );
  if (g.presion >= PR.umbralAviso && presionAntes < PR.umbralAviso) report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.presionAlta });

  // ---- ¿Termina?
  if (g.avance >= G.umbralVictoria) return terminarGuerra(s, 'victoria', report);
  if (g.avance <= -G.umbralVictoria) return terminarGuerra(s, 'derrota', report);
  if (dg.armisticio) {
    if (rng.chance(probArmisticio(s, esf))) return terminarGuerra(s, 'armisticio', report);
    report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.armisticioRechazado });
  }
  if (g.presion >= 100) return terminarGuerra(s, 'cese_impuesto', report);
}

/** El enemigo acepta más si viene perdiendo, si hay presión y si invertimos en diplomacia. */
export function probArmisticio(s: GameState, esf: Esfuerzo): number {
  const g = s.guerra;
  if (!g) return 0;
  const A = G.armisticio;
  return clamp(A.base + (esf.diplomacia / 100) * A.porDiplomacia + (g.presion / 100) * A.porPresion + (Math.max(0, g.avance) / 100) * A.porAvance, 0, 0.95);
}

export function terminarGuerra(s: GameState, resultado: TipoResultadoGuerra, report: EntradaParte[]): void {
  const g = s.guerra;
  if (!g) return;
  const fx = G.fin[resultado];
  s.ind.aprobacion = clamp(s.ind.aprobacion + fx.aprobacion, 0, 100);
  s.ind.estabilidad = clamp(s.ind.estabilidad + fx.estabilidad, 0, 100);
  s.ind.gobernabilidad = clamp(s.ind.gobernabilidad + fx.gobernabilidad, 0, 100);
  s.ind.reservas = Math.max(0, s.ind.reservas + fx.reservas);
  // La relación con el ex enemigo queda dañada por años.
  s.relacionesBase[g.contra] = G.relacionBasePosguerra;
  s.guerrasPasadas.push({
    contra: g.contra,
    desde: g.desde,
    hasta: s.turno,
    defensiva: g.defensiva,
    resultado,
    costoHumano: g.costoHumano,
    autorizada: g.autorizada,
  });
  report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.fin[resultado](nombrePais(g.contra)) });
  territorioPorGuerra(s, g.contra, resultado, g.avance, report);
  s.guerra = undefined;
}

/** Sanciones vigentes: drenan reservas y crecimiento hasta que vencen. */
export function stepSanciones(s: GameState, report: EntradaParte[]): void {
  if (!s.sanciones.length) return;
  // Mientras dure la guerra que las motivó, no corren los turnos de las sanciones.
  for (const x of s.sanciones) {
    s.ind.reservas = Math.max(0, s.ind.reservas + G.sanciones.reservas);
    s.ind.crecimiento += G.sanciones.crecimiento;
    if (!s.guerra) x.turnosRestantes -= 1;
  }
  const antes = s.sanciones.length;
  s.sanciones = s.sanciones.filter((x) => x.turnosRestantes > 0);
  if (s.sanciones.length < antes) report.push({ tag: 'GUERRA', texto: LINEAS_GUERRA.finSanciones });
}

// ---------------------------------------------------------------- Efectos sobre finales y legado

/** Hubo una derrota en los últimos N turnos (multiplica el riesgo de golpe). */
export const derrotaReciente = (s: GameState): boolean =>
  s.guerrasPasadas.some((r) => r.resultado === 'derrota' && s.turno - r.hasta <= G.turnosEfectoDerrota);

/** Guerra sin autorización vigente o reciente (habilita juicio político aunque no haya escándalo). */
export const guerraSinAutorizacion = (s: GameState): boolean =>
  (!!s.guerra && !s.guerra.autorizada) || s.guerrasPasadas.some((r) => !r.autorizada && s.turno - r.hasta <= G.turnosEfectoDerrota);

/** Aporte de las guerras al legado: { soberania, estabilidad } (en puntos de componente). */
export function legadoGuerra(s: GameState): { soberania: number; estabilidad: number } {
  const L = G.legado;
  let soberania = 0;
  let costo = 0;
  for (const r of s.guerrasPasadas) {
    const gloria = clamp(capacidadPais(r.contra) / Math.max(1, s.inicial.capacidadMilitar), G.gloria.min, G.gloria.max);
    soberania += r.resultado === 'victoria' ? L.victoria * gloria : L[r.resultado];
    costo += r.costoHumano;
  }
  if (s.guerra) {
    soberania += L.en_curso;
    costo += s.guerra.costoHumano;
  }
  // Territorio que quedó (ganado o perdido) al momento de medir.
  soberania += legadoTerritorio(s);
  return { soberania, estabilidad: -costo * L.porCostoHumano };
}

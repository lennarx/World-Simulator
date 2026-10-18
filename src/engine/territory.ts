// Territorio ocupado: lo que queda de una guerra entre vecinos (victoria, derrota o armisticio con la línea congelada).
// Retenerlo rinde (crecimiento, recaudación, reservas, soberanía) y cuesta (resistencia, guarnición, aislamiento,
// revancha). Se puede devolver por las buenas o reclamar el propio por vía diplomática.
import { CFG } from '../data/config';
import { LINEAS_TERRITORIO } from '../data/texts';
import { esVecino, nombrePais, pesoComercial } from './diplomacy';
import type { Rng } from './rng';
import type { AccionDiplomatica, EntradaParte, GameState, Territorio, TipoResultadoGuerra } from './types';
import { clamp } from './util';

const O = CFG.guerra.ocupacion;
const MIN = 0.01; // por debajo de esto la franja desaparece

const redondear = (x: number) => Math.round(x * 100) / 100;

/** Lo que `ocupante` le tiene a `de` (o undefined). */
export const territorioDe = (s: GameState, ocupante: string, de: string): Territorio | undefined =>
  s.territorios.find((t) => t.ocupante === ocupante && t.de === de);

/** Profundidad neta vista por el jugador: + lo que le ocupás a `id`, − lo que `id` te ocupa. */
export function balanceTerritorial(s: GameState, id: string): number {
  return (territorioDe(s, s.paisId, id)?.profundidad ?? 0) - (territorioDe(s, id, s.paisId)?.profundidad ?? 0);
}

/** Cuando una franja deja de existir, la relación base con ese país vuelve al nivel de posguerra (no al de antes). */
function liberar(s: GameState, otro: string): void {
  if (otro in s.relacionesBase) s.relacionesBase[otro] = Math.max(s.relacionesBase[otro]!, CFG.guerra.relacionBasePosguerra);
}

const quitar = (s: GameState, t: Territorio) => {
  s.territorios = s.territorios.filter((x) => x !== t);
  liberar(s, t.ocupante === s.paisId ? t.de : t.ocupante);
};

/**
 * `ganador` avanza `p` sobre `perdedor`: primero recupera lo propio que tenía ocupado y el resto lo ocupa (tope 1).
 * Devuelve cuánto se ocupó de nuevo.
 */
export function transferir(s: GameState, ganador: string, perdedor: string, p: number): number {
  let resto = p;
  const propio = territorioDe(s, perdedor, ganador);
  if (propio) {
    const r = Math.min(propio.profundidad, resto);
    propio.profundidad = redondear(propio.profundidad - r);
    resto -= r;
    if (propio.profundidad < MIN) quitar(s, propio);
  }
  if (resto < MIN) return 0;
  const t = territorioDe(s, ganador, perdedor);
  if (t) t.profundidad = redondear(Math.min(1, t.profundidad + resto));
  else s.territorios.push({ ocupante: ganador, de: perdedor, profundidad: redondear(Math.min(1, resto)), desde: s.turno });
  return resto;
}

/** Fin de una guerra: el territorio según el resultado. Solo entre vecinos (sin frente terrestre no se ocupa suelo). */
export function territorioPorGuerra(s: GameState, contra: string, resultado: TipoResultadoGuerra, avance: number, report: EntradaParte[]): void {
  if (!esVecino(s.paisId, contra)) return;
  const umbral = CFG.guerra.umbralVictoria;
  // Victoria/derrota: franja plena. Armisticio: se congela la línea del frente. Cese impuesto: fronteras previas.
  const p =
    resultado === 'victoria' ? 1 : resultado === 'derrota' ? -1 : resultado === 'armisticio' ? clamp(avance / umbral, -1, 1) : 0;
  const nombre = nombrePais(contra);
  if (p >= MIN) {
    transferir(s, s.paisId, contra, p);
    report.push({ tag: 'GUERRA', texto: LINEAS_TERRITORIO.ganado(nombre, Math.round(p * 100)) });
  } else if (p <= -MIN) {
    transferir(s, contra, s.paisId, -p);
    report.push({ tag: 'GUERRA', texto: LINEAS_TERRITORIO.perdido(nombre, Math.round(-p * 100)) });
  }
}

/** Efecto económico del territorio (puro: lo consumen economy y budget). */
export function bonusTerritorial(s: GameState): { crecimiento: number; recaudacion: number; reservas: number } {
  let crecimiento = 0;
  let recaudacion = 0;
  let reservas = 0;
  for (const t of s.territorios) {
    if (t.ocupante === s.paisId) {
      crecimiento += t.profundidad * (O.crecimiento + O.crecPorPeso * pesoComercial(t.de));
      recaudacion += t.profundidad * O.recaudacion;
      reservas += t.profundidad * O.reservas;
    } else if (t.de === s.paisId) {
      crecimiento += t.profundidad * O.perdidoCrecimiento;
      recaudacion += t.profundidad * O.perdidoRecaudacion;
    }
  }
  return { crecimiento, recaudacion, reservas };
}

/** Piso de defensa por guarnición (× base). 1 = sin territorio. */
export const multPisoDefensa = (s: GameState): number =>
  1 + O.pisoDefensa * s.territorios.filter((t) => t.ocupante === s.paisId).reduce((a, t) => a + t.profundidad, 0);

/** Costos políticos y diplomáticos por turno, y revancha del ocupado. */
export function stepTerritorios(s: GameState, rng: Rng, report: EntradaParte[]): void {
  for (const t of s.territorios) {
    const p = t.profundidad;
    if (t.ocupante === s.paisId) {
      // Resistencia: fuerte al principio, se asienta con el tiempo pero no desaparece.
      const asentamiento = Math.max(O.resistenciaMin, 1 - (s.turno - t.desde) / O.turnosAsentamiento);
      s.ind.estabilidad = clamp(s.ind.estabilidad - O.resistencia * p * asentamiento, 0, 100);
      if (t.de in s.relacionesBase) s.relacionesBase[t.de] = Math.min(s.relacionesBase[t.de]!, O.relacionBaseOcupado);
      for (const id of Object.keys(s.relaciones)) {
        if (id === t.de) continue;
        const delta = O.relacionRegion * p * (esVecino(t.de, id) ? 2 : 1);
        s.relaciones[id] = clamp(s.relaciones[id]! + delta, -100, 100);
      }
      if (!s.crisis && !s.guerra && rng.chance(O.probRevancha * p)) {
        s.crisis = { con: t.de, nivel: 2, turnos: 0 };
        s.crisisMaxNivel = Math.max(s.crisisMaxNivel, 2);
        report.push({ tag: 'GUERRA', texto: LINEAS_TERRITORIO.revancha(nombrePais(t.de)) });
      }
    } else if (t.de === s.paisId) {
      s.ind.aprobacion = clamp(s.ind.aprobacion + O.perdidoAprobacion * p, 0, 100);
      if (t.ocupante in s.relacionesBase) s.relacionesBase[t.ocupante] = Math.min(s.relacionesBase[t.ocupante]!, O.relacionBaseOcupado);
    }
  }
}

/** Acciones `devolver` y `reclamar` (las otras acciones diplomáticas las resuelve diplomacy.aplicarAcciones). */
export function aplicarAccionesTerritoriales(s: GameState, acciones: AccionDiplomatica[], rng: Rng, report: EntradaParte[]): void {
  const V = CFG.guerra.devolver;
  const R = CFG.guerra.reclamar;
  for (const a of acciones) {
    const nombre = nombrePais(a.con);
    if (a.tipo === 'devolver') {
      const t = territorioDe(s, s.paisId, a.con);
      if (!t) {
        report.push({ tag: 'DIPLOMACIA', texto: LINEAS_TERRITORIO.nadaQueDevolver(nombre) });
        continue;
      }
      quitar(s, t);
      s.relaciones[a.con] = clamp(s.relaciones[a.con]! + V.relacion, -100, 100);
      s.ind.aprobacion = clamp(s.ind.aprobacion + V.aprobacion, 0, 100);
      for (const id of Object.keys(s.relaciones)) if (id !== a.con) s.relaciones[id] = clamp(s.relaciones[id]! + V.region, -100, 100);
      report.push({ tag: 'DIPLOMACIA', texto: LINEAS_TERRITORIO.devuelto(nombre) });
    } else if (a.tipo === 'reclamar') {
      const t = territorioDe(s, a.con, s.paisId);
      if (!t) {
        report.push({ tag: 'DIPLOMACIA', texto: LINEAS_TERRITORIO.nadaQueReclamar(nombre) });
        continue;
      }
      const rel = s.relaciones[a.con] ?? -100;
      if (rel < R.relacionMin) {
        report.push({ tag: 'DIPLOMACIA', texto: LINEAS_TERRITORIO.reclamoSinRelacion(nombre) });
        continue;
      }
      if (rng.chance(clamp(R.probBase + (rel - R.relacionMin) * R.probPorRelacion, 0, 0.9))) {
        quitar(s, t);
        s.relaciones[a.con] = clamp(rel + R.relacionExito, -100, 100);
        report.push({ tag: 'DIPLOMACIA', texto: LINEAS_TERRITORIO.reclamoExitoso(nombre) });
      } else {
        s.relaciones[a.con] = clamp(rel + R.relacionFalla, -100, 100);
        report.push({ tag: 'DIPLOMACIA', texto: LINEAS_TERRITORIO.reclamoRechazado(nombre) });
      }
    }
  }
}

/** Aporte del territorio al componente de soberanía del legado. */
export function legadoTerritorio(s: GameState): number {
  return s.territorios.reduce(
    (a, t) => a + (t.ocupante === s.paisId ? t.profundidad * O.soberaniaLegado : t.de === s.paisId ? t.profundidad * O.perdidoLegado : 0),
    0,
  );
}

// Congreso: concesiones, probabilidad de voto por bloque y votación.
import { CFG } from '../data/config';
import { getLey } from './data';
import type { Rng } from './rng';
import type { Bloque, Decisiones, EntradaParte, GameState, Indicadores, Mods, TipoBloque } from './types';
import { clamp, sigmoid } from './util';

const C = CFG.congreso;

/** Cualquier cosa que se vota: una ley o un tratado. Solo importa cuánto le gusta a cada tipo de bloque. */
export interface Votable {
  apoyo: Record<TipoBloque, number>;
}

export function probVotoBloque(s: GameState, b: Bloque, v: Votable, concesion: number): number {
  const score =
    b.afinidad * C.pesoAfinidad + v.apoyo[b.tipo] + concesion * C.porConcesion + (s.ind.aprobacion - 50) * C.pesoAprobacion;
  return sigmoid(score / C.escala);
}

/** Bancas a favor esperadas (para mostrar en la UI antes de votar). */
export function votosEsperados(s: GameState, v: Votable, concesiones: Record<string, number>): { si: number; total: number } {
  const total = s.congreso.reduce((a, b) => a + b.bancas, 0);
  const si = s.congreso.reduce((a, b) => a + b.bancas * probVotoBloque(s, b, v, concesiones[b.id] ?? 0), 0);
  return { si, total };
}

/** Votación con azar. Cada bloque vota en bloque con prob. = disciplina; si no, se parte. */
export function votar(s: GameState, v: Votable, concesiones: Record<string, number>, rng: Rng): { aprobada: boolean; si: number; total: number } {
  let si = 0;
  let total = 0;
  for (const b of s.congreso) {
    const p = probVotoBloque(s, b, v, concesiones[b.id] ?? 0);
    total += b.bancas;
    if (rng.chance(b.disciplina)) {
      if (rng.chance(p)) si += b.bancas;
    } else {
      si += Math.round(b.bancas * clamp(p + rng.noise(C.ruidoVoto), 0, 1));
    }
  }
  return { aprobada: si > total / 2, si, total };
}

export function aplicarConcesiones(s: GameState, concesiones: Record<string, number>, report: EntradaParte[]): void {
  const puntos = Object.values(concesiones).reduce((a, b) => a + b, 0);
  if (puntos <= 0) return;
  for (const b of s.congreso) {
    const c = concesiones[b.id] ?? 0;
    if (c > 0) b.afinidad = clamp(b.afinidad + c * C.afinidadPorConcesion, -100, 100);
    else if (b.tipo === 'opositor') b.afinidad = clamp(b.afinidad - puntos * C.enojoOposicion, -100, 100);
  }
  report.push({ tag: 'CONGRESO', texto: `Se repartieron ${puntos} punto(s) de concesiones. La oposición denuncia "rosca"; los premiados, "diálogo".` });
}

export function resolverLey(s: GameState, d: Decisiones, rng: Rng, report: EntradaParte[]): boolean | null {
  if (!d.ley) return null;
  const ley = getLey(d.ley);
  if (!ley || s.leyesAprobadas.includes(ley.id)) return null;

  const { aprobada, si, total } = votar(s, ley, d.concesiones, rng);
  if (aprobada) {
    s.leyesAprobadas.push(ley.id);
    for (const [k, v] of Object.entries(ley.efectos)) {
      const key = k as keyof Indicadores;
      s.ind[key] = s.ind[key] + (v ?? 0);
    }
    for (const [k, v] of Object.entries(ley.mods)) {
      const key = k as keyof Mods;
      s.mods[key] = s.mods[key] + (v ?? 0);
    }
    s.ind.gobernabilidad = clamp(s.ind.gobernabilidad + C.bonoAprobada, 0, 100);
    report.push({ tag: 'CONGRESO', texto: `Aprobada: ${ley.nombre} (${si} de ${total} votos). Hubo abrazos y algún que otro reproche por lo bajo.` });
  } else {
    s.ind.gobernabilidad = clamp(s.ind.gobernabilidad - C.costoFracaso, 0, 100);
    report.push({ tag: 'CONGRESO', texto: `Rechazada: ${ley.nombre} (${si} de ${total} votos). Alguien prometió votos que no tenía.` });
  }
  return aprobada;
}

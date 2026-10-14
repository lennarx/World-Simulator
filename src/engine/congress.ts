// Congreso: concesiones, probabilidad de voto por bloque y votación.
import { CFG } from '../data/config';
import { getLey, type Ley } from './data';
import type { Rng } from './rng';
import type { Bloque, Decisiones, EntradaParte, GameState, Indicadores, Mods } from './types';
import { clamp, sigmoid } from './util';

const C = CFG.congreso;

export function probVotoBloque(s: GameState, b: Bloque, ley: Ley, concesion: number): number {
  const score =
    b.afinidad * C.pesoAfinidad + ley.apoyo[b.tipo] + concesion * C.porConcesion + (s.ind.aprobacion - 50) * C.pesoAprobacion;
  return sigmoid(score / C.escala);
}

/** Bancas a favor esperadas (para mostrar en la UI antes de votar). */
export function votosEsperados(s: GameState, ley: Ley, concesiones: Record<string, number>): { si: number; total: number } {
  const total = s.congreso.reduce((a, b) => a + b.bancas, 0);
  const si = s.congreso.reduce((a, b) => a + b.bancas * probVotoBloque(s, b, ley, concesiones[b.id] ?? 0), 0);
  return { si, total };
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

  let si = 0;
  let total = 0;
  for (const b of s.congreso) {
    const p = probVotoBloque(s, b, ley, d.concesiones[b.id] ?? 0);
    total += b.bancas;
    if (rng.chance(b.disciplina)) {
      // Vota en bloque.
      if (rng.chance(p)) si += b.bancas;
    } else {
      // Bloque partido: cada uno hace la suya (con algo de ruido).
      si += Math.round(b.bancas * clamp(p + rng.noise(C.ruidoVoto), 0, 1));
    }
  }
  const aprobada = si > total / 2;
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

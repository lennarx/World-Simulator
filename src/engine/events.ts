// Eventos de shock con condiciones declarativas (src/data/events.json).
import { CFG } from '../data/config';
import { EVENTOS, type Condicion, type Evento } from './data';
import { peorVecino, relacionPromedio, vecinosDe } from './diplomacy';
import type { Rng } from './rng';
import type { AreaId, EntradaParte, GameState, Indicadores } from './types';
import { clamp } from './util';

/** Resuelve una variable de condición: indicador, turno, presion, escandaloActivo, primaRiesgo o ratio.<area>. */
export function resolverVar(s: GameState, v: string): number {
  if (v.startsWith('ratio.')) {
    const area = v.slice(6) as AreaId;
    const base = s.presupuestoBase[area];
    return base > 0 ? s.presupuesto[area] / base : 1;
  }
  if (v in s.ind) return s.ind[v as keyof Indicadores];
  switch (v) {
    case 'turno':
      return s.turno;
    case 'presion':
      return s.presion;
    case 'escandaloActivo':
      return s.escandaloActivo;
    case 'primaRiesgo':
      return s.primaRiesgo;
    case 'relPromedio':
      return relacionPromedio(s.relaciones);
    case 'relMinVecinos': {
      const v = peorVecino(s);
      return v ? s.relaciones[v]! : 100;
    }
    default:
      throw new Error(`Variable de condición desconocida: ${v}`);
  }
}

export function cumple(s: GameState, c: Condicion): boolean {
  const x = resolverVar(s, c.var);
  switch (c.op) {
    case '<':
      return x < c.value;
    case '>':
      return x > c.value;
    case '<=':
      return x <= c.value;
    case '>=':
      return x >= c.value;
  }
}

export function pesoEvento(s: GameState, e: Evento, eventMult: Record<string, number> = {}): number {
  if (!e.cond.every((c) => cumple(s, c))) return 0;
  let w = e.peso * (eventMult[e.id] ?? 1);
  if (e.negativo) w *= 1 + s.presion * CFG.eventos.multNegativoPorPresion;
  if (e.tag === 'ESCÁNDALO') w *= Math.max(0, 1 + s.mods.riesgoEscandalo);
  if (e.escandalo && s.escandaloActivo > 0) return 0; // no se apilan escándalos grandes
  return w;
}

function aplicarDeltas(s: GameState, efectos: Partial<Indicadores>, mult = 1): void {
  for (const [k, v] of Object.entries(efectos)) {
    const key = k as keyof Indicadores;
    s.ind[key] = s.ind[key] + (v ?? 0) * mult;
  }
  // Mantener los rangos 0-100 de los indicadores políticos.
  for (const k of ['aprobacion', 'gobernabilidad', 'estabilidad', 'capacidadMilitar'] as const) s.ind[k] = clamp(s.ind[k], 0, 100);
  s.ind.reservas = Math.max(0, s.ind.reservas);
}

export function aplicarEvento(s: GameState, e: Evento, report: EntradaParte[], rng?: Rng): void {
  const mult = e.commodity ? s.perfil.sensibilidadCommodities : 1;
  aplicarDeltas(s, e.efectos, mult);
  if (e.temporal) s.temporales.push({ id: e.id, efectos: e.temporal.efectos, turnosRestantes: e.temporal.duracion });
  if (e.prima) s.primaRiesgo = Math.max(CFG.prima.min, s.primaRiesgo + e.prima);
  if (e.escandalo) s.escandaloActivo = CFG.eventos.duracionEscandalo;
  if (e.diplomacia) {
    const { objetivo, delta } = e.diplomacia;
    const vecinos = vecinosDe(s.paisId).filter((v) => v in s.relaciones);
    const objetivos =
      objetivo === 'todos'
        ? Object.keys(s.relaciones)
        : objetivo === 'vecinoPeor'
          ? [peorVecino(s)].filter((x): x is string => !!x)
          : vecinos.length && rng
            ? [vecinos[Math.floor(rng.next() * vecinos.length)]!]
            : [];
    for (const id of objetivos) s.relaciones[id] = clamp(s.relaciones[id]! + delta, -100, 100);
  }
  report.push({ tag: e.tag, texto: e.texto });
}

/** Aplica efectos temporales vigentes y descuenta su duración. */
export function aplicarTemporales(s: GameState): void {
  for (const t of s.temporales) {
    aplicarDeltas(s, t.efectos);
    t.turnosRestantes -= 1;
  }
  s.temporales = s.temporales.filter((t) => t.turnosRestantes > 0);
  if (s.escandaloActivo > 0) s.escandaloActivo -= 1;
}

export function rollEvents(s: GameState, rng: Rng, report: EntradaParte[]): Evento[] {
  const E = CFG.eventos;
  const ocurridos: Evento[] = [];
  const p = Math.min(0.95, E.probBase + s.presion * E.probPorPresion);
  if (!rng.chance(p)) return ocurridos;
  const cantidad = rng.chance(E.probSegundo) ? 2 : 1;
  for (let n = 0; n < cantidad; n++) {
    const candidatos = EVENTOS.filter((e) => !ocurridos.includes(e));
    const e = rng.pickWeighted(candidatos, (x) => pesoEvento(s, x, s.eventMult));
    if (!e) break;
    aplicarEvento(s, e, report, rng);
    ocurridos.push(e);
  }
  return ocurridos;
}

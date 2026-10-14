// Derrotas anticipadas y fin de mandato.
import { CFG } from '../data/config';
import { MENSAJES_FINAL } from '../data/texts';
import type { Rng } from './rng';
import { calcularLegado } from './score';
import type { EntradaParte, Final, GameState, TipoFinal } from './types';

const F = CFG.finales;

export function fraccionHostil(s: GameState): number {
  const total = s.congreso.reduce((a, b) => a + b.bancas, 0);
  const hostiles = s.congreso.filter((b) => b.afinidad < F.juicioAfinidadHostil).reduce((a, b) => a + b.bancas, 0);
  return hostiles / Math.max(1, total);
}

export function probGolpe(s: GameState): number {
  const i = s.ind;
  if (i.estabilidad >= F.golpeEstabilidad || i.gobernabilidad >= F.golpeGobernabilidad) return 0;
  const gap = F.golpeEstabilidad - i.estabilidad + (F.golpeGobernabilidad - i.gobernabilidad);
  // Fuerzas armadas desfinanciadas = más malestar (gancho con Fase 3).
  const malestarMilitar = 1 + (50 - i.capacidadMilitar) / 100;
  return Math.min(0.9, (F.golpeProbBase + gap * F.golpePorPunto) * malestarMilitar);
}

export function probJuicio(s: GameState): number {
  if (s.escandaloActivo <= 0 || fraccionHostil(s) < F.juicioUmbralBancas) return 0;
  const p = (F.juicioProbBase + Math.max(0, 40 - s.ind.aprobacion) * F.juicioPorDesaprobacion) * s.perfil.riesgoJuicio;
  return Math.min(0.9, p);
}

function cerrar(s: GameState, tipo: TipoFinal, rng: Rng, reelecto = false): Final {
  const legado = calcularLegado(s, reelecto);
  const anticipada = !['reelecto', 'mandato_cumplido', 'mandato_gris'].includes(tipo);
  const msgs = MENSAJES_FINAL[tipo];
  return {
    tipo,
    turno: s.turno,
    legado,
    victoria: !anticipada && legado.total >= CFG.legado.umbralVictoria,
    mensaje: msgs[Math.floor(rng.next() * msgs.length)] ?? '',
  };
}

export function checkEnding(s: GameState, rng: Rng, report: EntradaParte[]): Final | null {
  const i = s.ind;
  s.turnosGobBaja = i.gobernabilidad < F.gobCritica ? s.turnosGobBaja + 1 : 0;

  let tipo: TipoFinal | null = null;
  if (i.inflacion > F.inflacionColapso || i.deuda > F.deudaColapso || (i.reservas < F.reservasColapso && s.atraso >= F.atrasoColapso)) {
    tipo = 'colapso_economico';
  } else if (s.turnosGobBaja >= F.turnosGobCritica) {
    tipo = 'crisis_gobernabilidad';
  } else if (rng.chance(probJuicio(s))) {
    tipo = 'juicio_politico';
  } else if (rng.chance(probGolpe(s))) {
    tipo = 'golpe';
  }
  if (tipo) {
    const f = cerrar(s, tipo, rng);
    report.push({ tag: 'FINAL', texto: f.mensaje });
    return f;
  }

  if (s.turno >= CFG.turnosMandato) {
    const reelecto = i.aprobacion + rng.noise(CFG.legado.ruidoReeleccion) >= CFG.legado.umbralReeleccion;
    const prelim = calcularLegado(s, reelecto);
    const t: TipoFinal = reelecto ? 'reelecto' : prelim.total >= CFG.legado.umbralVictoria ? 'mandato_cumplido' : 'mandato_gris';
    const f = cerrar(s, t, rng, reelecto);
    report.push({ tag: 'FINAL', texto: f.mensaje });
    return f;
  }
  return null;
}

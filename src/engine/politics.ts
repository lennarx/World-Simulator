// Aprobación, gobernabilidad, estabilidad social, afinidad de bloques y capacidad militar.
import { CFG } from '../data/config';
import { deltaGastoPonderado } from './economy';
import type { Rng } from './rng';
import type { GameState } from './types';
import { approach, clamp } from './util';

const P = CFG.politica;

/** Afinidad media del Congreso ponderada por bancas, llevada a 0-100. */
export function apoyoLegislativo(s: GameState): number {
  const total = s.congreso.reduce((a, b) => a + b.bancas, 0);
  const media = s.congreso.reduce((a, b) => a + b.afinidad * b.bancas, 0) / Math.max(1, total);
  return (media + 100) / 2;
}

export function aprobacionObjetivo(s: GameState): number {
  const i = s.ind;
  const d = (a: Parameters<typeof deltaGastoPonderado>[1]) => deltaGastoPonderado(s, a);
  return (
    P.aprobacionBase +
    d('asistencia') * P.aprobPorAsistencia +
    d('salud') * P.aprobPorSalud +
    d('educacion') * P.aprobPorEducacion +
    d('seguridad') * P.aprobPorSeguridad +
    d('energia') * P.aprobPorEnergia +
    (s.impuestos - s.impuestosBase) * P.aprobPorImpuestos +
    Math.max(0, i.inflacion - s.inicial.inflacion) * P.aprobPorSubaInflacion +
    i.inflacion * P.aprobPorInflacion +
    Math.max(0, i.desempleo - s.inicial.desempleo) * P.aprobPorSubaDesempleo +
    i.crecimiento * P.aprobPorCrecimiento +
    (s.escandaloActivo > 0 ? P.aprobPorEscandalo : 0) +
    s.presion * P.aprobPorPresion
  );
}

export function stepPolitics(s: GameState, rng: Rng): void {
  const i = s.ind;
  const d = (a: Parameters<typeof deltaGastoPonderado>[1]) => deltaGastoPonderado(s, a);

  i.aprobacion = clamp(approach(i.aprobacion, aprobacionObjetivo(s), P.aprobSuavizado) + rng.noise(P.aprobRuido), 0, 100);

  // Los bloques se acercan a un gobierno popular y se alejan de uno impopular.
  for (const b of s.congreso) {
    const objetivo = clamp(b.afinidadBase + (i.aprobacion - 50) * P.afinidadPorAprobacion, -100, 100);
    b.afinidad = clamp(approach(b.afinidad, objetivo, P.afinidadDeriva), -100, 100);
  }

  const gobObjetivo =
    apoyoLegislativo(s) * P.gobPesoCongreso + i.aprobacion * P.gobPesoAprobacion + s.presion * P.gobPorPresion;
  i.gobernabilidad = clamp(approach(i.gobernabilidad, gobObjetivo, P.gobSuavizado), 0, 100);

  const estObjetivo =
    P.estabilidadBase +
    d('asistencia') * P.estabPorAsistencia +
    d('seguridad') * P.estabPorSeguridad +
    d('salud') * P.estabPorSalud +
    Math.max(0, i.inflacion - s.inicial.inflacion) * P.estabPorSubaInflacion +
    i.inflacion * P.estabPorInflacion +
    Math.max(0, i.desempleo - s.inicial.desempleo) * P.estabPorSubaDesempleo +
    (i.aprobacion - 50) * P.estabPorAprobacion;
  i.estabilidad = clamp(approach(i.estabilidad, estObjetivo, P.estabSuavizado), 0, 100);

  // Gancho Fase 3: la capacidad militar sigue (lento) al gasto en defensa relativo a la base.
  const base = Math.max(0.1, s.presupuestoBase.defensa);
  const relativo = (s.presupuesto.defensa - base) / base;
  const milObjetivo = clamp(s.inicial.capacidadMilitar + relativo * P.militarPorDefensa, 0, 100);
  i.capacidadMilitar = clamp(approach(i.capacidadMilitar, milObjetivo, P.militarSuavizado), 0, 100);
}

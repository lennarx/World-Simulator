// Situación de cada país de la región vista desde el jugador (Fase 4: mapa).
// Solo lectura: junta en un lugar lo que la UI necesita para pintar y describir un país.
import { esVecino, pesoComercial } from './diplomacy';
import type { GameState, TipoTratado } from './types';
import { capacidadPais } from './war';

export interface SituacionPais {
  id: string;
  esJugador: boolean;
  /** -100..100; 0 para el propio país. */
  relacion: number;
  vecino: boolean;
  tratados: TipoTratado[];
  /** Nivel de la crisis de frontera con ese país (1..3) o null. */
  crisis: number | null;
  guerra: boolean;
  /** Capacidad militar ilustrativa (la propia sale de los indicadores). */
  capacidad: number;
  pesoComercial: number;
}

export function situacionPais(s: GameState, id: string): SituacionPais {
  const esJugador = id === s.paisId;
  return {
    id,
    esJugador,
    relacion: esJugador ? 0 : (s.relaciones[id] ?? 0),
    vecino: esVecino(s.paisId, id),
    tratados: s.tratados.filter((t) => t.con === id).map((t) => t.tipo),
    crisis: s.crisis?.con === id ? s.crisis.nivel : null,
    guerra: s.guerra?.contra === id,
    capacidad: esJugador ? s.ind.capacidadMilitar : capacidadPais(id),
    pesoComercial: pesoComercial(id),
  };
}

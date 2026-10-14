// Tipos y acceso a los datos de leyes y eventos (JSON en src/data).
import billsJson from '../data/bills.json';
import eventsJson from '../data/events.json';
import type { Indicadores, Mods, TipoBloque, EntradaParte } from './types';

export interface Ley {
  id: string;
  nombre: string;
  descripcion: string;
  apoyo: Record<TipoBloque, number>;
  efectos: Partial<Indicadores>;
  mods: Partial<Mods>;
}

export interface Condicion {
  var: string;
  op: '<' | '>' | '<=' | '>=';
  value: number;
}

export interface Evento {
  id: string;
  tag: EntradaParte['tag'];
  peso: number;
  negativo: boolean;
  commodity?: boolean;
  escandalo?: boolean;
  cond: Condicion[];
  efectos: Partial<Indicadores>;
  temporal?: { efectos: Partial<Indicadores>; duracion: number };
  prima?: number;
  texto: string;
}

export const LEYES = billsJson as Ley[];
export const EVENTOS = eventsJson as Evento[];

export const getLey = (id: string) => LEYES.find((l) => l.id === id);

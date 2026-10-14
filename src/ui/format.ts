import type { IndicadorId } from '../engine';

export const fmt = (v: number, d = 1) => (Number.isFinite(v) ? v.toLocaleString('es-AR', { maximumFractionDigits: d, minimumFractionDigits: d }) : '—');

export interface MetaIndicador {
  nombre: string;
  unidad: string;
  /** true si subir es bueno. */
  subirEsBueno: boolean;
  ayuda: string;
}

export const INDICADORES: Record<IndicadorId, MetaIndicador> = {
  crecimiento: { nombre: 'Crecimiento', unidad: '% anual', subirEsBueno: true, ayuda: 'Variación del PBI anualizada.' },
  inflacion: { nombre: 'Inflación', unidad: '% anual', subirEsBueno: false, ayuda: 'Suba de precios anualizada.' },
  deuda: { nombre: 'Deuda', unidad: '% PBI', subirEsBueno: false, ayuda: 'Deuda pública sobre PBI.' },
  reservas: { nombre: 'Reservas', unidad: 'meses de import.', subirEsBueno: true, ayuda: 'Colchón de divisas. Bajo 3 hay presión cambiaria.' },
  desempleo: { nombre: 'Desempleo', unidad: '%', subirEsBueno: false, ayuda: 'Tasa de desocupación.' },
  aprobacion: { nombre: 'Aprobación', unidad: '/100', subirEsBueno: true, ayuda: 'Imagen del gobierno. Define la reelección.' },
  gobernabilidad: { nombre: 'Gobernabilidad', unidad: '/100', subirEsBueno: true, ayuda: 'Capacidad de gobernar. Si queda crítica varios turnos, crisis.' },
  estabilidad: { nombre: 'Estabilidad social', unidad: '/100', subirEsBueno: true, ayuda: 'Paz social. Muy baja + gobernabilidad baja = riesgo institucional.' },
  capacidadMilitar: { nombre: 'Capacidad militar', unidad: '/100', subirEsBueno: true, ayuda: 'Sigue al gasto en defensa. Se usa en fases futuras (diplomacia y defensa).' },
};

export const AREAS_NOMBRE = {
  salud: 'Salud',
  educacion: 'Educación',
  seguridad: 'Seguridad',
  defensa: 'Defensa',
  infraestructura: 'Infraestructura',
  asistencia: 'Asistencia social',
  energia: 'Energía (subsidios e inversión)',
  deuda: 'Servicio de deuda',
} as const;

export const trimestre = (turno: number) => {
  const t = Math.max(1, turno);
  return `Año ${Math.ceil(t / 4)} · T${((t - 1) % 4) + 1}`;
};

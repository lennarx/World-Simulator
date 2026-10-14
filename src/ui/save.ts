// Guardado: localStorage (siempre con try/catch: modo privado, cuota llena, etc.) + export/import JSON.
import { relacionesIniciales, STATE_VERSION, type Decisiones, type EntradaParte, type GameState } from '../engine';

export const SAVE_VERSION = 2;
const KEY = 'simgob:partida';

export interface ParteTurno {
  turno: number;
  entradas: EntradaParte[];
}

export interface SaveFile {
  app: 'simulador-gobierno-sa';
  version: number;
  savedAt: string;
  state: GameState;
  draft: Decisiones | null;
  partes: ParteTurno[];
}

export function crearSave(state: GameState, draft: Decisiones | null, partes: ParteTurno[]): SaveFile {
  return { app: 'simulador-gobierno-sa', version: SAVE_VERSION, savedAt: new Date().toISOString(), state, draft, partes };
}

/**
 * Migraciones de saves viejos. v1 (Fase 1) -> v2 (Fase 2): se agregan relaciones, tratados y crisis.
 * Si cambia la forma del estado, sumá un paso acá y subí SAVE_VERSION y STATE_VERSION.
 */
export function migrarSave(d: Partial<SaveFile>): Partial<SaveFile> {
  if (d.version === 1 && d.state && typeof d.state.paisId === 'string') {
    const rel = relacionesIniciales(d.state.paisId);
    const state = { ...d.state, version: 2, relaciones: { ...rel }, relacionesBase: rel, tratados: [], crisis: null, crisisMaxNivel: 0 };
    const draft = d.draft ? { ...d.draft, diplomacia: [], tratado: null, respuestaCrisis: null } : null;
    return { ...d, version: 2, state, draft };
  }
  return d;
}

/** Validación mínima de forma. Devuelve el save o un mensaje de error legible. */
export function validarSave(data: unknown): SaveFile | string {
  if (!data || typeof data !== 'object') return 'El archivo no es una partida válida.';
  const d = migrarSave(data as Partial<SaveFile>);
  if (d.app !== 'simulador-gobierno-sa') return 'Este archivo no es de este simulador.';
  if (d.version !== SAVE_VERSION) return `Versión de guardado incompatible (${String(d.version)}).`;
  const s = d.state as Partial<GameState> | undefined;
  if (!s || typeof s !== 'object' || typeof s.paisId !== 'string' || typeof s.turno !== 'number' || !s.ind || !Array.isArray(s.congreso))
    return 'La partida está incompleta o dañada.';
  if (s.version !== STATE_VERSION) return 'La partida es de otra versión del motor.';
  if (Object.values(s.ind).some((v) => typeof v !== 'number' || !Number.isFinite(v))) return 'La partida tiene valores inválidos.';
  if (!s.relaciones || typeof s.relaciones !== 'object' || !Array.isArray(s.tratados)) return 'A la partida le faltan datos diplomáticos.';
  return { ...(d as SaveFile), partes: Array.isArray(d.partes) ? d.partes : [], draft: d.draft ?? null };
}

export function guardarLocal(save: SaveFile): boolean {
  try {
    localStorage.setItem(KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function cargarLocal(): SaveFile | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = validarSave(JSON.parse(raw));
    return typeof v === 'string' ? null : v;
  } catch {
    return null;
  }
}

export function borrarLocal(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* sin storage: nada que borrar */
  }
}

export function exportarArchivo(save: SaveFile): void {
  try {
    const blob = new Blob([JSON.stringify(save, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `partida-${save.state.paisId}-T${save.state.turno}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    alert('No se pudo exportar la partida.');
  }
}

export async function leerArchivo(file: File): Promise<SaveFile | string> {
  try {
    const text = await file.text();
    return validarSave(JSON.parse(text));
  } catch {
    return 'No se pudo leer el archivo (¿es un JSON?).';
  }
}

/** Preferencias chicas (tema, cartel iOS descartado). */
export function leerPref(key: string): string | null {
  try {
    return localStorage.getItem(`simgob:${key}`);
  } catch {
    return null;
  }
}
export function escribirPref(key: string, value: string | null): void {
  try {
    if (value === null) localStorage.removeItem(`simgob:${key}`);
    else localStorage.setItem(`simgob:${key}`, value);
  } catch {
    /* ignorar */
  }
}

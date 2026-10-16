// Estado de UI (Zustand). Llama al motor; el motor nunca conoce a la UI.
import { create } from 'zustand';
import { CFG } from '../data/config';
import { getPais } from '../data/countries';
import { advanceTurn, createGame, decisionesActuales, interesesExigibles, type Decisiones, type GameState } from '../engine';
import { borrarLocal, cargarLocal, crearSave, guardarLocal, type ParteTurno, type SaveFile } from './save';

export type Pantalla = 'inicio' | 'panel' | 'presupuesto' | 'congreso' | 'diplomacia' | 'parte' | 'final';

interface Store {
  game: GameState | null;
  draft: Decisiones | null;
  partes: ParteTurno[];
  pantalla: Pantalla;
  guardadoOk: boolean;
  /** Si está activo, al cerrar el trimestre el pago de deuda nunca queda bajo los intereses exigibles. */
  autoIntereses: boolean;
  setAutoIntereses: (v: boolean) => void;
  nuevaPartida: (paisId: string, semilla?: string) => void;
  cargarDesde: (save: SaveFile) => void;
  continuar: () => boolean;
  setDraft: (patch: Partial<Decisiones>) => void;
  cerrarTrimestre: () => void;
  irA: (p: Pantalla) => void;
  salir: () => void;
  snapshot: () => SaveFile | null;
}

const persistir = (game: GameState, draft: Decisiones | null, partes: ParteTurno[]) => guardarLocal(crearSave(game, draft, partes));

export const useGame = create<Store>((set, get) => ({
  game: null,
  draft: null,
  partes: [],
  pantalla: 'inicio',
  guardadoOk: true,
  autoIntereses: true,
  setAutoIntereses: (autoIntereses) => set({ autoIntereses }),

  nuevaPartida(paisId, semilla) {
    const seed = semilla?.trim() ? semilla.trim() : Math.floor(Math.random() * 2 ** 31);
    const game = createGame(getPais(paisId), seed);
    const draft = decisionesActuales(game);
    set({ game, draft, partes: [], pantalla: 'panel', guardadoOk: persistir(game, draft, []) });
  },

  cargarDesde(save) {
    const draft = save.draft ?? decisionesActuales(save.state);
    set({ game: save.state, draft, partes: save.partes, pantalla: save.state.final ? 'final' : 'panel' });
    set({ guardadoOk: persistir(save.state, draft, save.partes) });
  },

  continuar() {
    const save = cargarLocal();
    if (!save) return false;
    get().cargarDesde(save);
    return true;
  },

  setDraft(patch) {
    const { draft, game, partes } = get();
    if (!draft || !game) return;
    const next = { ...draft, ...patch };
    set({ draft: next, guardadoOk: persistir(game, next, partes) });
  },

  cerrarTrimestre() {
    const { game, draft, partes } = get();
    if (!game || !draft || game.final) return;
    const { state, report } = advanceTurn(game, draft);
    // El borrador del turno siguiente arranca igual al anterior, pero sin ley ni concesiones.
    const nextDraft = { ...decisionesActuales(state), presupuesto: { ...draft.presupuesto } };
    // En guerra el motor impone un piso de defensa: lo reflejamos en el borrador para que la UI no mienta.
    if (state.guerra) {
      const piso = state.presupuestoBase.defensa * CFG.guerra.multDefensaGuerra;
      nextDraft.presupuesto.defensa = Math.max(nextDraft.presupuesto.defensa, piso);
    }
    if (get().autoIntereses) {
      const minimo = Math.ceil(interesesExigibles(state) * 10) / 10;
      nextDraft.presupuesto.deuda = Math.max(nextDraft.presupuesto.deuda, minimo);
    }
    const nuevasPartes = [...partes, { turno: state.turno, entradas: report }];
    set({ game: state, draft: nextDraft, partes: nuevasPartes, pantalla: 'parte', guardadoOk: persistir(state, nextDraft, nuevasPartes) });
  },

  irA(pantalla) {
    set({ pantalla });
    if (typeof window !== 'undefined') window.scrollTo?.(0, 0);
  },

  salir() {
    set({ game: null, draft: null, partes: [], pantalla: 'inicio' });
  },

  snapshot() {
    const { game, draft, partes } = get();
    return game ? crearSave(game, draft, partes) : null;
  },
}));

export { borrarLocal };

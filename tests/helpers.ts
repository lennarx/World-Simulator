import { getPais } from '../src/data/countries';
import { createGame, decisionesActuales, type Decisiones, type GameState } from '../src/engine';

export const nuevo = (pais = 'argentina', seed: number | string = 42): GameState => createGame(getPais(pais), seed);
export const decisiones = (s: GameState, patch: Partial<Decisiones> = {}): Decisiones => ({ ...decisionesActuales(s), ...patch });

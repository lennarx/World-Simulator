// Registro de países. Los jugables tienen datos completos; el resto aparece como "Próximamente"
// (se completan en la Fase 4). Todos los valores son ilustrativos.
import type { DatosPais } from '../../engine/types';
import argentina from './argentina.json';
import brasil from './brasil.json';
import peru from './peru.json';
import proximamente from './proximamente.json';

export interface PaisResumen {
  id: string;
  nombre: string;
  playable: boolean;
  problema: string;
}

export const PAISES_JUGABLES: DatosPais[] = [argentina, brasil, peru] as DatosPais[];

export const TODOS_LOS_PAISES: PaisResumen[] = [
  ...PAISES_JUGABLES.map(({ id, nombre, problema }) => ({ id, nombre, problema, playable: true })),
  ...proximamente,
].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

export function getPais(id: string): DatosPais {
  const p = PAISES_JUGABLES.find((x) => x.id === id);
  if (!p) throw new Error(`País no jugable o inexistente: ${id}`);
  return p;
}

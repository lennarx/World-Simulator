// Diagnóstico de balance: promedios de indicadores finales y componentes de legado.
import { PAISES_JUGABLES } from '../data/countries';
import { jugar } from './run';
import { ESTRATEGIAS } from './strategies';
import { fraccionHostil } from '../engine/endings';

const n = Number(process.argv[2]) || 200;
for (const p of PAISES_JUGABLES) for (const e of Object.keys(ESTRATEGIAS)) {
  const acc: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const { state: s } = jugar(p.id, e, 1000 + i);
    const add = (k: string, v: number) => (acc[k] = (acc[k] ?? 0) + v / n);
    for (const [k, v] of Object.entries(s.ind)) add(k, v);
    for (const [k, v] of Object.entries(s.final!.legado)) add('L.' + k, v);
    add('prima', s.primaRiesgo); add('presion', s.presion); add('hostil', fraccionHostil(s)); add('leyes', s.leyesAprobadas.length);
    add('deficit', s.historial.at(-1)!.deficit);
  }
  console.log(p.id.padEnd(10), e.padEnd(12), Object.entries(acc).map(([k, v]) => `${k}=${v.toFixed(1)}`).join(' '));
}

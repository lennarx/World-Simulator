// Simulación headless de balance: `npm run sim` (opcional: `npm run sim -- 1000` para cambiar N).
// Juega N partidas con semilla por país × estrategia y muestra una tabla.
import { PAISES_JUGABLES } from '../data/countries';
import { advanceTurn, createGame, type GameState, type TipoFinal } from '../engine';
import { ESTRATEGIAS } from './strategies';

export interface FilaSim {
  pais: string;
  estrategia: string;
  partidas: number;
  victorias: number;
  reelecciones: number;
  legadoMedio: number;
  turnosMedio: number;
  finales: Partial<Record<TipoFinal, number>>;
  nan: number;
  conCrisis: number; // partidas con al menos una crisis de frontera
  crisisNivel3: number; // partidas que llegaron al nivel 3 (gancho Fase 3)
  tratadosMedio: number;
  conGuerra: number; // partidas con al menos una guerra
  victoriasMilitares: number; // guerras ganadas (total)
  guerras: number; // guerras terminadas o en curso (total)
  turnosGuerra: number; // turnos de guerra promedio por guerra
}

function tieneNaN(s: GameState): boolean {
  return Object.values(s.ind).some((v) => !Number.isFinite(v)) || !Number.isFinite(s.primaRiesgo) || !Number.isFinite(s.presion);
}

export function jugar(paisId: string, estrategia: string, semilla: number): { state: GameState; nan: boolean } {
  const pais = PAISES_JUGABLES.find((p) => p.id === paisId)!;
  let s = createGame(pais, semilla);
  let nan = false;
  const est = ESTRATEGIAS[estrategia]!;
  for (let t = 0; t < 100 && !s.final; t++) {
    s = advanceTurn(s, est(s)).state;
    if (tieneNaN(s)) nan = true;
  }
  return { state: s, nan };
}

export function correrSim(n: number): FilaSim[] {
  const filas: FilaSim[] = [];
  for (const pais of PAISES_JUGABLES) {
    for (const estrategia of Object.keys(ESTRATEGIAS)) {
      const fila: FilaSim = { pais: pais.id, estrategia, partidas: n, victorias: 0, reelecciones: 0, legadoMedio: 0, turnosMedio: 0, finales: {}, nan: 0, conCrisis: 0, crisisNivel3: 0, tratadosMedio: 0, conGuerra: 0, victoriasMilitares: 0, guerras: 0, turnosGuerra: 0 };
      for (let i = 0; i < n; i++) {
        const { state, nan } = jugar(pais.id, estrategia, 1000 + i);
        const f = state.final!;
        if (nan) fila.nan++;
        if (f.victoria) fila.victorias++;
        if (f.tipo === 'reelecto') fila.reelecciones++;
        fila.legadoMedio += f.legado.total / n;
        fila.turnosMedio += f.turno / n;
        fila.finales[f.tipo] = (fila.finales[f.tipo] ?? 0) + 1;
        if (state.crisisMaxNivel > 0) fila.conCrisis++;
        if (state.crisisMaxNivel >= 3) fila.crisisNivel3++;
        fila.tratadosMedio += state.tratados.length / n;
        const guerras = state.guerrasPasadas.length + (state.guerra ? 1 : 0);
        if (guerras > 0) fila.conGuerra++;
        fila.guerras += guerras;
        fila.victoriasMilitares += state.guerrasPasadas.filter((g) => g.resultado === 'victoria').length;
        fila.turnosGuerra += state.guerrasPasadas.reduce((a, g) => a + (g.hasta - g.desde), 0) + (state.guerra ? state.guerra.turnos : 0);
      }
      if (fila.guerras) fila.turnosGuerra /= fila.guerras;
      filas.push(fila);
    }
  }
  return filas;
}

const ABREV: Record<TipoFinal, string> = {
  reelecto: 'reel',
  mandato_cumplido: 'cumpl',
  mandato_gris: 'gris',
  crisis_gobernabilidad: 'gob',
  colapso_economico: 'colap',
  golpe: 'golpe',
  juicio_politico: 'juicio',
};

function imprimir(filas: FilaSim[]) {
  const pct = (x: number, n: number) => `${Math.round((100 * x) / n)}%`.padStart(4);
  console.log('país       estrategia       victoria reelec legado turnos NaN crisis niv3 trat guerra gMil durG  finales');
  for (const f of filas) {
    const fin = (Object.entries(f.finales) as [TipoFinal, number][])
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${ABREV[k]} ${pct(v, f.partidas).trim()}`)
      .join(' · ');
    console.log(
      `${f.pais.padEnd(10)} ${f.estrategia.padEnd(16)} ${pct(f.victorias, f.partidas)}     ${pct(f.reelecciones, f.partidas)}  ${f.legadoMedio.toFixed(1).padStart(5)} ${f.turnosMedio.toFixed(1).padStart(5)}  ${String(f.nan).padStart(3)}  ${pct(f.conCrisis, f.partidas)} ${pct(f.crisisNivel3, f.partidas)} ${f.tratadosMedio.toFixed(1).padStart(4)}  ${pct(f.conGuerra, f.partidas)} ${(f.guerras ? pct(f.victoriasMilitares, f.guerras) : '   -')} ${f.turnosGuerra.toFixed(1).padStart(4)}  ${fin}`,
    );
  }
}

const esMain = process.argv[1]?.replace(/\\/g, '/').endsWith('src/sim/run.ts');
if (esMain) {
  const n = Number(process.argv[2]) || 400;
  console.log(`Simulación: ${n} partidas por país × estrategia (semillas 1000..${1000 + n - 1})\n`);
  imprimir(correrSim(n));
}

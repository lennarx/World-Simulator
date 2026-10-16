// Legado: 5 componentes 0-100, medidos sobre todo como MEJORA vs. el inicio del mandato,
// así un país que arranca complicado no queda condenado de entrada.
import { CFG } from '../data/config';
import { relacionPromedio, relacionesIniciales } from './diplomacy';
import { legadoGuerra } from './war';
import type { GameState, Legado } from './types';
import { clamp } from './util';

const L = CFG.legado;
const pct = (v: number) => clamp(Math.round(v), 0, 100);

export function calcularLegado(s: GameState, reelecto: boolean): Legado {
  const ini = s.inicial;
  const fin = s.ind;
  const hist = s.historial.slice(1); // sin el turno 0
  const prom = (f: (x: (typeof hist)[number]) => number) =>
    hist.length ? hist.reduce((a, h) => a + f(h), 0) / hist.length : 0;

  const crecimiento = pct(50 + (prom((h) => h.ind.crecimiento) - s.perfil.potencial) * L.crecPorPunto);
  // log-ratio: bajar la inflación de 60 a 20 vale lo mismo que de 15 a 5 (aprox.).
  // Guerras (Fase 3): resultado en soberanía; costo humano en estabilidad.
  const guerra = legadoGuerra(s);
  const estabilidad = pct(
    50 +
      L.estabPorLogInflacion * Math.log((Math.max(0, ini.inflacion) + 5) / (Math.max(0, fin.inflacion) + 5)) +
      (prom((h) => h.ind.estabilidad) - 50) * L.estabPorEstabilidad +
      guerra.estabilidad,
  );
  const bienestar = pct(
    50 + (ini.desempleo - fin.desempleo) * L.bienPorDesempleo + (prom((h) => h.ind.estabilidad) - 50) * L.bienPorEstabilidad,
  );
  const soberania = pct(
    50 +
      (ini.deuda - fin.deuda) * L.sobPorDeuda +
      (fin.reservas - ini.reservas) * L.sobPorReservas +
      (fin.capacidadMilitar - ini.capacidadMilitar) * L.sobPorMilitar +
      // Prestigio regional (Fase 2): mejora de la relación promedio vs. las relaciones iniciales de los datos
      // (no vs. relacionesBase, que una guerra modifica).
      (relacionPromedio(s.relaciones) - relacionPromedio(relacionesIniciales(s.paisId))) * CFG.diplomacia.legadoPorRelacion +
      guerra.soberania,
  );
  const aprobacion = pct(fin.aprobacion);
  const w = L.pesos;
  const base =
    crecimiento * w.crecimiento +
    estabilidad * w.estabilidad +
    bienestar * w.bienestar +
    soberania * w.soberania +
    aprobacion * w.aprobacion;
  const bonusReeleccion = reelecto ? L.bonusReeleccion : 0;
  return {
    crecimiento,
    estabilidad,
    bienestar,
    soberania,
    aprobacion,
    bonusReeleccion,
    guerra: Math.round(guerra.soberania + guerra.estabilidad),
    total: Math.round(base + bonusReeleccion),
  };
}

// Macro: prima de riesgo, inflación, crecimiento, desempleo, reservas y licuación de deuda.
import { CFG } from '../data/config';
import type { ResultadoFiscal } from './budget';
import type { Rng } from './rng';
import type { GameState } from './types';
import { approach, clamp } from './util';

const E = CFG.economia;

export function primaObjetivo(s: GameState): number {
  const P = CFG.prima;
  const v =
    P.base +
    Math.max(0, s.ind.deuda - P.umbralDeuda) * P.porDeuda +
    Math.max(0, s.ind.inflacion - P.umbralInflacion) * P.porInflacion -
    s.ind.reservas * P.porReservas +
    s.atraso * CFG.fiscal.primaPorAtraso +
    s.mods.prima;
  return clamp(v, P.min, P.max);
}

export function potencialTotal(s: GameState): number {
  return s.perfil.potencial + s.mods.potencial;
}

/** Inversión "productiva" del presupuesto: infraestructura pesa entero; educación y energía a medias. */
function inversion(p: GameState['presupuesto']): number {
  return p.infraestructura + 0.5 * p.educacion + 0.5 * p.energia;
}

/** Diferencia de gasto primario vs. la base. Los recortes pesan más según la rigidez del país. */
export function deltaGastoPonderado(s: GameState, area: keyof GameState['presupuesto']): number {
  const d = s.presupuesto[area] - s.presupuestoBase[area];
  const rigidez = clamp(s.perfil.rigidez + s.mods.rigidez, 0, 2);
  return d < 0 ? d * (1 + rigidez) : d;
}

export function stepEconomy(s: GameState, f: ResultadoFiscal, rng: Rng): void {
  const ind = s.ind;

  // Prima de riesgo: converge al objetivo de a poco (los mercados también tienen inercia).
  s.primaRiesgo = approach(s.primaRiesgo, primaObjetivo(s), CFG.prima.suavizado);

  // ---- Inflación: inercia + ancla + impulsos.
  const inercia = clamp(s.perfil.inercia + s.mods.inercia, 0.3, 0.98);
  const impulsoEmision = f.emision * CFG.fiscal.emisionInflacion * s.perfil.sensibilidadEmision;
  const devaluacion = Math.max(0, E.reservasCriticas - ind.reservas) * E.devaluacionPorMes;
  const presionDeficit = Math.max(0, f.deficit - E.umbralDeficitInflacion) * E.deficitInflacion;
  ind.inflacion = clamp(
    inercia * ind.inflacion + (1 - inercia) * E.anclaInflacion + impulsoEmision + devaluacion + presionDeficit,
    E.inflacionMin,
    E.inflacionMax,
  );

  // ---- Crecimiento: potencial + capital acumulado + impulso fiscal - frenos.
  const invDelta = inversion(s.presupuesto) - inversion(s.presupuestoBase);
  s.capital = clamp(s.capital * E.capitalRetencion + invDelta * E.capitalAporte, -E.capitalMax, E.capitalMax);

  const areasPrimarias = ['salud', 'educacion', 'seguridad', 'defensa', 'infraestructura', 'asistencia', 'energia'] as const;
  const impulso = areasPrimarias.reduce((acc, a) => acc + deltaGastoPonderado(s, a), 0) + f.concesiones;
  const crecObjetivo =
    potencialTotal(s) +
    s.capital * E.capitalEfecto +
    impulso * E.impulsoFiscal -
    (s.impuestos - s.impuestosBase) * E.dragImpuestos -
    Math.max(0, ind.inflacion - E.umbralDragInflacion) * E.dragInflacion -
    s.primaRiesgo * E.dragPrima +
    rng.noise(E.ruidoCrecimiento);
  ind.crecimiento = clamp(approach(ind.crecimiento, crecObjetivo, E.suavizadoCrecimiento), E.crecimientoMin, E.crecimientoMax);

  // ---- Desempleo (Okun trimestral) con reversión hacia el desempleo inicial del país.
  ind.desempleo = clamp(
    ind.desempleo +
      (E.okun * (potencialTotal(s) - ind.crecimiento)) / CFG.trimestresPorAnio +
      (s.inicial.desempleo - ind.desempleo) * E.reversionDesempleo,
    E.desempleoMin,
    E.desempleoMax,
  );

  // ---- Reservas.
  ind.reservas = clamp(
    ind.reservas +
      E.reservasDeriva +
      Math.max(0, -f.deficit) * E.reservasPorSuperavit -
      f.emision * CFG.fiscal.emisionReservas -
      (s.atraso > 0 ? E.reservasPorAtraso : 0) -
      Math.max(0, ind.inflacion) * E.reservasPorInflacion,
    0,
    E.reservasMax,
  );

  // ---- Licuación de deuda/PBI por crecimiento nominal (la inflación licúa solo una parte).
  const licuacion =
    (Math.max(0, ind.crecimiento) + Math.min(Math.max(0, ind.inflacion), CFG.fiscal.licuacionTopeInflacion) * CFG.fiscal.licuacionInflacion) /
    (100 * CFG.trimestresPorAnio);
  ind.deuda = clamp(ind.deuda * (1 - licuacion), 0, E.deudaMax);
}

// Orquestador del turno: estado + decisiones + RNG (dentro del estado) -> estado nuevo + parte.
import { CFG } from '../data/config';
import { LINEAS_ECONOMIA, LINEAS_GOBIERNO } from '../data/texts';
import { applyBudget, sanitizarDecisiones } from './budget';
import { aplicarConcesiones, resolverLey } from './congress';
import { aplicarAcciones, resolverTratado, sanitizarDiplomacia, stepCrisis, stepRelaciones } from './diplomacy';
import { stepEconomy } from './economy';
import { checkEnding } from './endings';
import { aplicarTemporales, rollEvents } from './events';
import { stepPolitics } from './politics';
import { stepPressure } from './pressure';
import { resolverDeclaracion, sanitizarGuerra, stepAtaqueEnemigo, stepGuerra, stepSanciones } from './war';
import { createRng } from './rng';
import type { Decisiones, EntradaParte, GameState, ResultadoTurno } from './types';
import { round } from './util';

/** Decisiones "no tocar nada": mismo presupuesto, impuestos y financiamiento que el turno anterior. */
export function decisionesActuales(s: GameState): Decisiones {
  return {
    presupuesto: { ...s.presupuesto },
    impuestos: s.impuestos,
    financiamiento: s.financiamiento,
    ley: null,
    concesiones: {},
    diplomacia: [],
    tratado: null,
    respuestaCrisis: null,
    guerra: { declarar: null, siRechaza: 'desistir', esfuerzo: s.guerra?.ultimoEsfuerzo ?? null, armisticio: false },
  };
}

export function advanceTurn(prev: GameState, decisionesCrudas: Decisiones): ResultadoTurno {
  if (prev.final) return { state: prev, report: [] };
  const s: GameState = structuredClone(prev);
  const rng = createRng(s.rng);
  const report: EntradaParte[] = [];
  const d: Decisiones = { ...sanitizarDecisiones(decisionesCrudas), ...sanitizarDiplomacia(s, decisionesCrudas) };
  d.guerra = sanitizarGuerra(s, decisionesCrudas);
  // Declarar la guerra ocupa la votación del turno (desplaza a ley y tratado).
  if (d.guerra.declarar) {
    d.ley = null;
    d.tratado = null;
  }
  // En guerra, el gasto en defensa tiene piso (se aplica en el motor: no se confía en la UI).
  if (s.guerra) d.presupuesto.defensa = Math.max(d.presupuesto.defensa, s.presupuestoBase.defensa * CFG.guerra.multDefensaGuerra);
  s.turno += 1;

  const antes = { ...prev.ind };

  // 1. Presupuesto y financiamiento.
  const fiscal = applyBudget(s, d);
  if (fiscal.enAtraso) report.push({ tag: 'ECONOMÍA', texto: LINEAS_ECONOMIA.atraso });
  if (fiscal.emision > 0) report.push({ tag: 'ECONOMÍA', texto: LINEAS_ECONOMIA.emision });
  if (fiscal.deficit < 0) report.push({ tag: 'ECONOMÍA', texto: LINEAS_ECONOMIA.superavit });

  // 2. Congreso.
  aplicarConcesiones(s, d.concesiones, report);
  if (d.guerra.declarar) resolverDeclaracion(s, d, rng, report);
  else if (d.tratado) resolverTratado(s, d, rng, report);
  else resolverLey(s, d, rng, report);

  // 2b. Diplomacia: acciones del turno.
  aplicarAcciones(s, d.diplomacia, report);

  // 3. Economía.
  stepEconomy(s, fiscal, rng);

  // 4. Eventos (primero los temporales vigentes, después los nuevos).
  aplicarTemporales(s);
  rollEvents(s, rng, report);

  // 4b. Relaciones (deriva y obligaciones) y crisis de frontera.
  stepRelaciones(s, fiscal, report);
  stepCrisis(s, d.respuestaCrisis, rng, report);

  // 4c. Guerra: ataque enemigo (crisis nivel 3), combate del turno y sanciones.
  stepAtaqueEnemigo(s, rng, report);
  stepGuerra(s, d.guerra, rng, report);
  stepSanciones(s, report);

  // 5. Política y sociedad.
  stepPolitics(s, rng);

  // 6. Presión.
  stepPressure(s);

  // Resumen narrativo del trimestre.
  const i = s.ind;
  if (i.inflacion > antes.inflacion + 2) report.push({ tag: 'ECONOMÍA', texto: `${LINEAS_ECONOMIA.inflacionSube} (${round(i.inflacion)}% anual)` });
  else if (i.inflacion < antes.inflacion - 2) report.push({ tag: 'ECONOMÍA', texto: `${LINEAS_ECONOMIA.inflacionBaja} (${round(i.inflacion)}% anual)` });
  if (i.crecimiento < 0) report.push({ tag: 'ECONOMÍA', texto: LINEAS_ECONOMIA.recesion });
  else if (i.crecimiento > s.perfil.potencial + 1) report.push({ tag: 'ECONOMÍA', texto: LINEAS_ECONOMIA.crecimientoBueno });
  if (i.aprobacion >= 60) report.push({ tag: 'GOBIERNO', texto: LINEAS_GOBIERNO.aprobacionAlta });
  else if (i.aprobacion < 30) report.push({ tag: 'GOBIERNO', texto: LINEAS_GOBIERNO.aprobacionBaja });
  if (i.gobernabilidad < CFG.finales.gobCritica + 8) report.push({ tag: 'GOBIERNO', texto: LINEAS_GOBIERNO.gobBaja });
  if (s.presion >= 50 && prev.presion < 50) report.push({ tag: 'PRESIÓN', texto: LINEAS_GOBIERNO.presionAlta });

  s.historial.push({ turno: s.turno, ind: { ...s.ind }, deficit: fiscal.deficit });

  // 7. ¿Se terminó?
  s.final = checkEnding(s, rng, report);

  s.rng = rng.state();
  return { state: s, report };
}

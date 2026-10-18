// Diplomacia (Fase 2): relaciones bilaterales, acciones, tratados y crisis de frontera.
// Las relaciones van de -100 a 100 y derivan hacia su valor base (relations.json).
import { CFG } from '../data/config';
import { TODOS_LOS_PAISES } from '../data/countries';
import geografia from '../data/geografia.json';
import relationsJson from '../data/relations.json';
import { votar, votosEsperados } from './congress';
import type { Rng } from './rng';
import type { AccionDiplomatica, Decisiones, EntradaParte, GameState, TipoTratado, Tratado } from './types';
import { clamp } from './util';

const D = CFG.diplomacia;
const GEO = geografia.paises as Record<string, { vecinos: string[]; pesoComercial: number }>;
const PARES = relationsJson.pares as { a: string; b: string; valor: number }[];

export const TIPOS_ACCION = ['visita', 'cooperacion', 'protesta', 'gesto', 'devolver', 'reclamar'] as const;
export const TIPOS_TRATADO = ['comercio', 'defensa', 'integracion'] as const;

// ---------------------------------------------------------------- Datos

export const vecinosDe = (id: string): string[] => GEO[id]?.vecinos ?? [];
export const esVecino = (a: string, b: string) => vecinosDe(a).includes(b);
export const pesoComercial = (id: string): number => GEO[id]?.pesoComercial ?? 0;
export const nombrePais = (id: string): string => TODOS_LOS_PAISES.find((p) => p.id === id)?.nombre ?? id;

/** Todos los demás países (los 11), vecinos primero. */
export function otrosPaises(paisId: string): string[] {
  const otros = Object.keys(GEO).filter((id) => id !== paisId);
  return otros.sort((a, b) => Number(esVecino(paisId, b)) - Number(esVecino(paisId, a)) || nombrePais(a).localeCompare(nombrePais(b), 'es'));
}

export function relacionesIniciales(paisId: string): Record<string, number> {
  const r: Record<string, number> = {};
  for (const otro of otrosPaises(paisId)) {
    const par = PARES.find((p) => (p.a === paisId && p.b === otro) || (p.b === paisId && p.a === otro));
    r[otro] = par ? par.valor : D.relacionDefault;
  }
  return r;
}

const ajustarRelacion = (s: GameState, con: string, delta: number) => {
  if (!(con in s.relaciones)) return;
  s.relaciones[con] = clamp(s.relaciones[con]! + delta, -100, 100);
};

export const relacionPromedio = (rel: Record<string, number>): number => {
  const v = Object.values(rel);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
};

/** Peor relación con un vecino (o null si no hay vecinos). */
export function peorVecino(s: GameState): string | null {
  const vs = vecinosDe(s.paisId).filter((v) => v in s.relaciones);
  if (!vs.length) return null;
  return vs.reduce((peor, v) => (s.relaciones[v]! < s.relaciones[peor]! ? v : peor));
}

export const tieneTratado = (s: GameState, tipo: TipoTratado, con?: string) =>
  s.tratados.some((t) => t.tipo === tipo && (con === undefined || t.con === con));

// ---------------------------------------------------------------- Validación

export function sanitizarDiplomacia(s: GameState, d: Decisiones): Pick<Decisiones, 'diplomacia' | 'tratado' | 'respuestaCrisis' | 'ley'> {
  const validas = (d.diplomacia ?? [])
    .filter((a): a is AccionDiplomatica => !!a && (TIPOS_ACCION as readonly string[]).includes(a.tipo) && a.con in s.relaciones)
    .slice(0, D.accionesPorTurno);
  const t = d.tratado;
  const tratado = t && (TIPOS_TRATADO as readonly string[]).includes(t.tipo) && t.con in s.relaciones ? { tipo: t.tipo, con: t.con } : null;
  const r = d.respuestaCrisis;
  const respuestaCrisis = s.crisis && (r === 'negociar' || r === 'escalar' || r === 'ignorar') ? r : null;
  // Una sola votación por turno: el tratado le gana a la ley.
  return { diplomacia: validas, tratado, respuestaCrisis, ley: tratado ? null : (d.ley ?? null) };
}

// ---------------------------------------------------------------- Acciones

/** `devolver` y `reclamar` (territorio) los resuelve territory.aplicarAccionesTerritoriales. */
export function aplicarAcciones(s: GameState, acciones: AccionDiplomatica[], report: EntradaParte[]): void {
  const A = D.acciones;
  for (const a of acciones) {
    const rel = s.relaciones[a.con]!;
    const nombre = nombrePais(a.con);
    switch (a.tipo) {
      case 'visita':
        ajustarRelacion(s, a.con, (A.visita.relacion * (100 - rel)) / 100);
        report.push({ tag: 'DIPLOMACIA', texto: `Visita oficial a ${nombre}: apretones de manos, comunicado conjunto y promesas de "profundizar el vínculo".` });
        break;
      case 'cooperacion':
        if (rel < A.cooperacion.relacionMin) {
          report.push({ tag: 'DIPLOMACIA', texto: `La cancillería de ${nombre} no acepta cooperar en seguridad: la relación no da.` });
          break;
        }
        ajustarRelacion(s, a.con, (A.cooperacion.relacion * (100 - rel)) / 100);
        s.ind.estabilidad = clamp(s.ind.estabilidad + A.cooperacion.estabilidad, 0, 100);
        report.push({ tag: 'DIPLOMACIA', texto: `Acuerdo de cooperación en seguridad con ${nombre}. Las fuerzas de ambos lados intercambian información (y mate).` });
        break;
      case 'protesta':
        ajustarRelacion(s, a.con, A.protesta.relacion);
        if (s.crisis?.con === a.con) s.ind.aprobacion = clamp(s.ind.aprobacion + A.protesta.aprobacionEnCrisis, 0, 100);
        report.push({ tag: 'DIPLOMACIA', texto: `Protesta formal ante ${nombre}. Se convoca al embajador "a consultas", que es la forma elegante de decir "vení que hablamos".` });
        break;
      case 'gesto':
        ajustarRelacion(s, a.con, A.gesto.relacion);
        s.ind.aprobacion = clamp(s.ind.aprobacion + A.gesto.aprobacion, 0, 100);
        report.push({ tag: 'DIPLOMACIA', texto: `Discurso encendido contra ${nombre}. Puertas adentro aplauden; la cancillería se agarra la cabeza.` });
        break;
    }
  }
}

// ---------------------------------------------------------------- Tratados

/** Para votar un tratado, el Congreso usa el apoyo por tipo de bloque definido en CFG. */
export const votableTratado = (tipo: TipoTratado) => ({ apoyo: D.tratados[tipo].apoyo });

export function puedeFirmar(s: GameState, tipo: TipoTratado, con: string): { ok: boolean; motivo?: string } {
  if (tieneTratado(s, tipo, con)) return { ok: false, motivo: 'Ya existe ese tratado.' };
  const min = D.tratados[tipo].relacionMin;
  if ((s.relaciones[con] ?? -100) < min) return { ok: false, motivo: `Hace falta una relación de al menos ${min}.` };
  if (s.crisis?.con === con) return { ok: false, motivo: 'No se firma nada en medio de una crisis.' };
  return { ok: true };
}

export function votosTratado(s: GameState, tipo: TipoTratado, concesiones: Record<string, number>) {
  return votosEsperados(s, votableTratado(tipo), concesiones);
}

const NOMBRE_TRATADO: Record<TipoTratado, string> = {
  comercio: 'tratado de libre comercio',
  defensa: 'tratado de defensa mutua',
  integracion: 'acuerdo de integración regional',
};

export function resolverTratado(s: GameState, d: Decisiones, rng: Rng, report: EntradaParte[]): boolean | null {
  if (!d.tratado) return null;
  const { tipo, con } = d.tratado;
  const nombre = nombrePais(con);
  const puede = puedeFirmar(s, tipo, con);
  if (!puede.ok) {
    report.push({ tag: 'DIPLOMACIA', texto: `${nombre} no firma el ${NOMBRE_TRATADO[tipo]}. ${puede.motivo ?? ''}` });
    return false;
  }
  const v = votar(s, votableTratado(tipo), d.concesiones, rng);
  if (!v.aprobada) {
    s.ind.gobernabilidad = clamp(s.ind.gobernabilidad - CFG.congreso.costoFracaso, 0, 100);
    report.push({ tag: 'CONGRESO', texto: `El Congreso rechaza el ${NOMBRE_TRATADO[tipo]} con ${nombre} (${v.si} de ${v.total}). La cancillería vuelve con la carpeta bajo el brazo.` });
    return false;
  }
  const primeraIntegracion = tipo === 'integracion' && !tieneTratado(s, 'integracion');
  const t: Tratado = { tipo, con, desde: s.turno };
  s.tratados.push(t);
  if (primeraIntegracion) s.mods.prima += D.tratados.integracion.prima;
  s.ind.gobernabilidad = clamp(s.ind.gobernabilidad + D.bonoRatificacion, 0, 100);
  report.push({ tag: 'DIPLOMACIA', texto: `Ratificado el ${NOMBRE_TRATADO[tipo]} con ${nombre} (${v.si} de ${v.total} votos). Firma con lapicera prestada, como manda la tradición.` });
  return true;
}

/** Efecto de los tratados vigentes sobre la economía (puro: lo consume economy.stepEconomy). */
export function bonusDiplomatico(s: GameState): { crecimiento: number; reservas: number; militar: number } {
  const T = D.tratados;
  const pesoTotal = s.tratados.filter((t) => t.tipo === 'comercio').reduce((a, t) => a + pesoComercial(t.con), 0);
  const crecimiento =
    Math.min(T.comercio.topeCrecimiento, T.comercio.crecimiento * pesoTotal) + (tieneTratado(s, 'integracion') ? T.integracion.crecimiento : 0);
  const reservas = Math.min(T.comercio.topeReservas, T.comercio.reservas * pesoTotal);
  const militar = tieneTratado(s, 'defensa') ? T.defensa.militar : 0;
  return { crecimiento, reservas, militar };
}

// ---------------------------------------------------------------- Paso de turno

/** Deriva hacia la base + obligaciones de los acuerdos de integración. */
export function stepRelaciones(s: GameState, fiscal: { deficit: number; emision: number }, report: EntradaParte[]): void {
  for (const id of Object.keys(s.relaciones)) {
    const base = s.relacionesBase[id] ?? D.relacionDefault;
    s.relaciones[id] = clamp(s.relaciones[id]! + (base - s.relaciones[id]!) * D.deriva, -100, 100);
  }
  const I = D.tratados.integracion;
  const incumple = fiscal.emision > 0 || fiscal.deficit > I.deficitMax;
  if (incumple) {
    const socios = s.tratados.filter((t) => t.tipo === 'integracion');
    for (const t of socios) ajustarRelacion(s, t.con, -I.castigoRelacion);
    if (socios.length)
      report.push({ tag: 'DIPLOMACIA', texto: 'Los socios de la integración se quejan: "así no se puede, compañeros". Incumplimos las metas fiscales del acuerdo.' });
  }
}

const C = D.crisis;

/** Crisis de frontera: responde a la activa o, si no hay, puede nacer una con el peor vecino. */
export function stepCrisis(s: GameState, respuesta: Decisiones['respuestaCrisis'], rng: Rng, report: EntradaParte[]): void {
  if (s.crisis) {
    const c = s.crisis;
    const nombre = nombrePais(c.con);
    const r = respuesta ?? 'ignorar';
    if (r === 'negociar') {
      ajustarRelacion(s, c.con, C.negociar.relacion);
      s.ind.aprobacion = clamp(s.ind.aprobacion + C.negociar.aprobacion, 0, 100);
      c.nivel = Math.max(0, c.nivel - 1);
      report.push({ tag: 'DIPLOMACIA', texto: `Se negocia con ${nombre}. La oposición dice "entreguismo"; los mediadores, "madurez".` });
    } else if (r === 'escalar') {
      // Un aliado defensivo (con otro país) hace que escalar cueste menos.
      const alivio = s.tratados.some((t) => t.tipo === 'defensa' && t.con !== c.con) ? D.tratados.defensa.alivioCrisis : 1;
      ajustarRelacion(s, c.con, C.escalar.relacion);
      s.ind.aprobacion = clamp(s.ind.aprobacion + C.escalar.aprobacion, 0, 100);
      s.ind.reservas = Math.max(0, s.ind.reservas + C.escalar.reservas * alivio);
      s.ind.crecimiento += C.escalar.crecimiento * alivio;
      s.primaRiesgo += C.escalar.prima * alivio;
      c.nivel = Math.min(3, c.nivel + 1);
      report.push({ tag: 'DIPLOMACIA', texto: `Se endurece la postura ante ${nombre}. Las encuestas suben; los mercados, no.` });
    } else {
      s.ind.estabilidad = clamp(s.ind.estabilidad + C.ignorar.estabilidad, 0, 100);
    }

    if (c.nivel <= 0 || (s.relaciones[c.con] ?? 0) >= C.relacionResuelta) {
      report.push({ tag: 'DIPLOMACIA', texto: `Se cierra la crisis con ${nombre}. Comunicado conjunto, foto y cada uno a su casa.` });
      s.crisis = null;
      return;
    }

    // Costos que se acumulan mientras dure la crisis, proporcionales al nivel.
    s.ind.reservas = Math.max(0, s.ind.reservas + C.porNivel.reservas * c.nivel);
    s.ind.crecimiento += C.porNivel.crecimiento * c.nivel;
    s.ind.estabilidad = clamp(s.ind.estabilidad + C.porNivel.estabilidad * c.nivel, 0, 100);
    c.turnos += 1;
    s.crisisMaxNivel = Math.max(s.crisisMaxNivel, c.nivel);

    if (c.nivel === 3) {
      // Gancho Fase 3: acá podría dispararse un conflicto armado. Por ahora, la mediación internacional presiona.
      report.push({ tag: 'DIPLOMACIA', texto: `Tensión máxima con ${nombre}: movimientos de tropas en la frontera y la región pide calma. Nadie quiere que esto termine mal.` });
      if (rng.chance(C.mediacionNivel3)) {
        c.nivel = 2;
        report.push({ tag: 'DIPLOMACIA', texto: 'La mediación regional logra bajar un cambio. Se respira un poco mejor.' });
      }
    }
    return;
  }

  // Durante una guerra no nacen crisis nuevas: la tensión ya está (y el peor vecino suele ser el enemigo).
  if (s.guerra) return;
  const v = peorVecino(s);
  if (!v) return;
  const rel = s.relaciones[v]!;
  if (rel >= C.umbral) return;
  const p = Math.min(C.probMax, C.probBase + (C.umbral - rel) * C.probPorPunto);
  if (rng.chance(p)) {
    s.crisis = { con: v, nivel: 1, turnos: 0 };
    s.crisisMaxNivel = Math.max(s.crisisMaxNivel, 1);
    report.push({ tag: 'DIPLOMACIA', texto: `Crisis de frontera con ${nombrePais(v)}: un incidente en un paso limítrofe escala a disputa diplomática.` });
  }
}

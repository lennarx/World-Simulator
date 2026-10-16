// Tipos del motor. Puro TS: nada de React ni DOM acá.

export type IndicadorId =
  | 'crecimiento' // % anual
  | 'inflacion' // % anual
  | 'deuda' // % del PBI
  | 'reservas' // meses de importaciones
  | 'desempleo' // %
  | 'aprobacion' // 0-100
  | 'gobernabilidad' // 0-100
  | 'estabilidad' // 0-100 (estabilidad social)
  | 'capacidadMilitar'; // 0-100 (gancho para Fase 3)

export type Indicadores = Record<IndicadorId, number>;

export const AREAS = [
  'salud',
  'educacion',
  'seguridad',
  'defensa',
  'infraestructura',
  'asistencia',
  'energia',
  'deuda',
] as const;
export type AreaId = (typeof AREAS)[number];

/** Gasto por área en % del PBI anual. */
export type Presupuesto = Record<AreaId, number>;

export type Financiamiento = 'deuda' | 'emision' | 'mixto';

export type TipoBloque = 'oficialismo' | 'aliado' | 'centro' | 'opositor' | 'regional';

export interface Bloque {
  id: string;
  nombre: string;
  tipo: TipoBloque;
  bancas: number;
  afinidad: number; // -100..100
  afinidadBase: number; // hacia donde deriva
  disciplina: number; // 0..1: prob. de votar en bloque
}

/** Modificadores permanentes (leyes) que tocan el modelo. */
export interface Mods {
  recaudacion: number; // +% PBI de recaudación
  potencial: number; // +pp de crecimiento potencial
  prima: number; // +pp de prima de riesgo
  riesgoEscandalo: number; // multiplicador aditivo sobre peso de escándalos
  inercia: number; // +/- inercia inflacionaria
  rigidez: number; // +/- rigidez del gasto
}

export interface EfectoTemporal {
  id: string;
  efectos: Partial<Indicadores>; // delta por turno
  turnosRestantes: number;
}

// ---------------------------------------------------------------- Guerra (Fase 3)
export type FrenteMilitar = 'aire' | 'mar' | 'frontera';
export type DestinoEsfuerzo = FrenteMilitar | 'economia' | 'diplomacia';
/** Reparto del esfuerzo del turno: suma 100. */
export type Esfuerzo = Record<DestinoEsfuerzo, number>;
export type TipoResultadoGuerra = 'victoria' | 'armisticio' | 'cese_impuesto' | 'derrota';

export interface EstadoGuerra {
  contra: string;
  desde: number; // turno de inicio
  turnos: number;
  defensiva: boolean; // nos atacaron
  autorizada: boolean; // la votó el Congreso (las defensivas, siempre)
  avance: number; // -100..100 (positivo = ganamos terreno)
  presion: number; // presión internacional 0..100 (100 = cese del fuego impuesto)
  costoHumano: number; // índice 0..100, se informa con respeto
  capacidadEnemiga: number;
  moral: number; // 0..100
  ultimoEsfuerzo: Esfuerzo;
  ultimosFrentes: Partial<Record<FrenteMilitar, 'ganado' | 'perdido'>>;
}

export interface ResultadoGuerra {
  contra: string;
  desde: number;
  hasta: number;
  defensiva: boolean;
  resultado: TipoResultadoGuerra;
  costoHumano: number;
  autorizada: boolean;
}

export interface Sancion {
  motivo: string;
  turnosRestantes: number;
}

export interface PerfilPais {
  inercia: number; // 0..1, cuánto de la inflación pasada se arrastra
  sensibilidadEmision: number; // multiplicador del impacto inflacionario de emitir
  tasaBase: number; // % tasa de interés de la deuda sin prima
  potencial: number; // % crecimiento potencial
  rigidez: number; // 0..1, cuánto duelen los recortes respecto del presupuesto base
  riesgoJuicio: number; // multiplicador del riesgo de juicio político
  sensibilidadCommodities: number; // multiplicador de shocks de commodities
  costoConcesion: number; // multiplicador del costo fiscal de las concesiones al Congreso
}

export interface DatosPais {
  id: string;
  nombre: string;
  gentilicio: string;
  playable: boolean;
  resumen: string;
  problema: string;
  indicadores: Indicadores;
  presupuesto: Presupuesto;
  impuestos: number; // recaudación % PBI
  financiamientoInicial: Financiamiento;
  perfil: PerfilPais;
  congreso: Omit<Bloque, 'afinidadBase'>[];
  eventMult?: Record<string, number>;
}

export interface EntradaParte {
  tag: 'ECONOMÍA' | 'SOCIEDAD' | 'CONGRESO' | 'CLIMA' | 'ESCÁNDALO' | 'GOBIERNO' | 'EVENTO' | 'PRESIÓN' | 'DIPLOMACIA' | 'GUERRA' | 'FINAL';
  texto: string;
}

export type TipoFinal =
  | 'reelecto'
  | 'mandato_cumplido'
  | 'mandato_gris'
  | 'crisis_gobernabilidad'
  | 'colapso_economico'
  | 'golpe'
  | 'juicio_politico';

export interface Legado {
  crecimiento: number;
  estabilidad: number;
  bienestar: number;
  soberania: number;
  aprobacion: number;
  bonusReeleccion: number;
  /** Informativo: cuánto sumaron/restaron las guerras (ya incluido en soberanía y estabilidad). */
  guerra: number;
  total: number;
}

export interface Final {
  tipo: TipoFinal;
  turno: number;
  legado: Legado;
  victoria: boolean;
  mensaje: string;
}

// ---------------------------------------------------------------- Diplomacia (Fase 2)
export type TipoAccion = 'visita' | 'cooperacion' | 'protesta' | 'gesto';
export type TipoTratado = 'comercio' | 'defensa' | 'integracion';
export type RespuestaCrisis = 'negociar' | 'escalar' | 'ignorar';

export interface AccionDiplomatica {
  tipo: TipoAccion;
  con: string; // id de país
}

export interface Tratado {
  tipo: TipoTratado;
  con: string;
  desde: number; // turno de firma
}

export interface CrisisFrontera {
  con: string;
  nivel: number; // 1..3; 3 = al borde del conflicto (gancho Fase 3)
  turnos: number;
}

export interface Decisiones {
  presupuesto: Presupuesto;
  impuestos: number;
  financiamiento: Financiamiento;
  /** Ley a impulsar este turno (id de bills.json) o null. */
  ley: string | null;
  /** Concesiones a bloques: id de bloque -> % PBI de gasto extra (one-shot). */
  concesiones: Record<string, number>;
  /** Acciones diplomáticas del turno (máx. CFG.diplomacia.accionesPorTurno). */
  diplomacia: AccionDiplomatica[];
  /** Tratado a firmar este turno. Ocupa la votación del Congreso: si hay tratado, `ley` se ignora. */
  tratado: { tipo: TipoTratado; con: string } | null;
  /** Respuesta a la crisis de frontera activa (null = ignorar). */
  respuestaCrisis: RespuestaCrisis | null;
  guerra: DecisionGuerra;
}

export interface DecisionGuerra {
  /** Declarar la guerra a este país (ocupa la votación del turno: pide autorización al Congreso). */
  declarar: string | null;
  /** Si el Congreso rechaza la autorización: desistir o ir igual por decreto. */
  siRechaza: 'desistir' | 'avanzar';
  /** Reparto del esfuerzo durante la guerra (null = reparto por defecto). */
  esfuerzo: Esfuerzo | null;
  /** Proponer un armisticio este turno. */
  armisticio: boolean;
}

export interface Snapshot {
  turno: number;
  ind: Indicadores;
  deficit: number;
}

export interface GameState {
  version: number;
  paisId: string;
  semilla: number;
  rng: number; // estado interno del RNG
  turno: number; // turnos jugados (0 = inicio)
  ind: Indicadores;
  inicial: Indicadores;
  presupuestoBase: Presupuesto;
  presupuesto: Presupuesto;
  impuestos: number;
  impuestosBase: number;
  financiamiento: Financiamiento;
  perfil: PerfilPais;
  congreso: Bloque[];
  eventMult: Record<string, number>;
  mods: Mods;
  temporales: EfectoTemporal[];
  /** Stocks con retardo: inversión acumulada que empuja crecimiento. */
  capital: number;
  primaRiesgo: number; // pp
  atraso: number; // turnos seguidos pagando menos que los intereses
  presion: number; // 0..100
  escandaloActivo: number; // turnos restantes de escándalo
  turnosGobBaja: number; // turnos seguidos con gobernabilidad bajo el umbral
  leyesAprobadas: string[];
  historial: Snapshot[];
  final: Final | null;
  // Diplomacia (Fase 2)
  relaciones: Record<string, number>;
  relacionesBase: Record<string, number>;
  tratados: Tratado[];
  crisis: CrisisFrontera | null;
  crisisMaxNivel: number; // máximo nivel alcanzado en la partida (para el sim y el final)
  // Guerra (Fase 3)
  guerra?: EstadoGuerra;
  guerrasPasadas: ResultadoGuerra[];
  sanciones: Sancion[];
}

export interface ResultadoTurno {
  state: GameState;
  report: EntradaParte[];
}

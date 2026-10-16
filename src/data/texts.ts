// Textos del parte y de los finales. Humor rioplatense leve; nunca a costa de víctimas.
import type { TipoFinal } from '../engine/types';

export const TITULOS_FINAL: Record<TipoFinal, string> = {
  reelecto: 'Reelección',
  mandato_cumplido: 'Mandato cumplido',
  mandato_gris: 'Mandato cumplido (a duras penas)',
  crisis_gobernabilidad: 'Crisis de gobernabilidad',
  colapso_economico: 'Colapso económico',
  golpe: 'Quiebre institucional',
  juicio_politico: 'Juicio político',
};

export const MENSAJES_FINAL: Record<TipoFinal, string[]> = {
  reelecto: [
    'Cuatro años más. Tus ministros ya están pidiendo vacaciones que no van a tener.',
    'Ganaste otra vez. La oposición dice que fue el viento de cola; vos decís que fue el timón.',
  ],
  mandato_cumplido: [
    'Terminaste el mandato con la frente alta y la billetera del Estado más o menos entera.',
    'Entregás la banda en orden. Los libros de historia te van a dedicar un párrafo amable (y corto).',
  ],
  mandato_gris: [
    'Llegaste al final, que no es poco. Los historiadores ya están discutiendo si "gestión" es la palabra.',
    'Mandato completo. Lo mejor que dicen de vos es que "podría haber sido peor".',
  ],
  crisis_gobernabilidad: [
    'Sin Congreso, sin calle y sin aliados. Renunciaste antes de que te renunciaran.',
    'El gabinete se fue en fila india. Al final quedaste solo con el edecán, que también miraba el reloj.',
  ],
  colapso_economico: [
    'La economía colapsó. Los precios cambiaban más rápido que los ministros, y eso que los ministros cambiaban rápido.',
    'Default, corrida y góndolas que se remarcan solas. Tu nombre ya es sinónimo de "nunca más" en las cátedras de economía.',
  ],
  golpe: [
    'Se quebró el orden constitucional. Un final que nadie celebra: la democracia siempre pierde en estos casos.',
  ],
  juicio_politico: [
    'El Congreso votó tu destitución. Te enteraste por la tele, como todos.',
    'Juicio político. Los que ayer te sacaban fotos hoy dicen que "siempre tuvieron dudas".',
  ],
};

export const LINEAS_ECONOMIA = {
  inflacionSube: 'La inflación sube: los supermercados contratan más remarcadores que cajeros.',
  inflacionBaja: 'La inflación afloja. Algunos ya se animan a mirar los precios sin anteojos oscuros.',
  crecimientoBueno: 'La economía crece y los economistas discuten si fue mérito o suerte.',
  recesion: 'Recesión: el PBI va para atrás como cangrejo con apuro.',
  atraso: 'No alcanzó para pagar los intereses. Los acreedores mandan saludos (y abogados).',
  emision: 'Se financia el déficit con emisión. La maquinita trabaja a dos turnos.',
  superavit: 'Superávit fiscal. El ministro de Economía no sabe qué hacer con tanta felicidad.',
};

export const LINEAS_GOBIERNO = {
  aprobacionAlta: 'La aprobación está alta. Cuidado: el aplauso también se gasta.',
  aprobacionBaja: 'La aprobación está por el piso. Los asesores recomiendan "más territorio".',
  gobBaja: 'La gobernabilidad tambalea. En los pasillos del Congreso se habla de vos (y no bien).',
  presionAlta: 'El desgaste se nota: cada problema nuevo pesa el doble.',
};

// ---------------------------------------------------------------- Guerra (Fase 3)
// Tono SERIO. El humor queda para la política (Congreso, mercados); nunca para las víctimas.
export const LINEAS_GUERRA = {
  declaracion: (pais: string) => `El gobierno declara la guerra a ${pais}. Se decreta la movilización y se cierran los pasos fronterizos.`,
  ataque: (pais: string) => `${pais} inicia acciones armadas en la frontera. El gobierno convoca al Consejo de Defensa y responde.`,
  autorizada: (si: number, total: number) => `El Congreso autoriza el uso de la fuerza (${si} de ${total} votos).`,
  rechazada: (si: number, total: number) => `El Congreso niega la autorización (${si} de ${total} votos).`,
  desiste: 'Sin autorización legislativa, el gobierno desiste. En los pasillos hablan de "papelón"; en las calles, de alivio.',
  decreto: 'Sin autorización del Congreso, el gobierno avanza por decreto. Juristas y oposición advierten sobre la legalidad de la medida.',
  frenteGanado: (frente: string) => `Frente ${frente}: las fuerzas propias consolidan posiciones.`,
  frentePerdido: (frente: string) => `Frente ${frente}: retroceso de las fuerzas propias.`,
  costoHumano: 'Se informan nuevas bajas y familias desplazadas en las zonas de combate. El gobierno decreta duelo y asistencia a los afectados.',
  presionAlta: 'Organismos internacionales exigen un alto el fuego inmediato. La presión diplomática crece.',
  armisticioRechazado: 'La propuesta de armisticio no prospera. Los combates continúan.',
  fin: {
    victoria: (pais: string) => `Se firma la rendición de ${pais}. Una victoria con un costo humano que el país no olvidará.`,
    armisticio: (pais: string) => `Armisticio con ${pais}. Callan las armas; queda la reconstrucción.`,
    cese_impuesto: (pais: string) => `La comunidad internacional impone el cese del fuego con ${pais}. Nadie gana; todos cuentan pérdidas.`,
    derrota: (pais: string) => `Derrota militar frente a ${pais}. El país enfrenta duelo, crisis política y una larga reconstrucción.`,
  },
  sanciones: 'Varios países aplican sanciones comerciales en respuesta a la agresión.',
  finSanciones: 'Se levantan las sanciones comerciales.',
} as const;

export const NOMBRE_FRENTE = { aire: 'aéreo', mar: 'naval', frontera: 'terrestre' } as const;

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

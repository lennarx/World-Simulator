// Mapa ESQUEMÁTICO de Sudamérica (Fase 4). Dibujo original low-poly, no a escala ni con trazado oficial:
// sirve para ubicar países y pintar su situación. Sin banderas, escudos ni símbolos.
// Las fronteras se definen UNA vez (lon, lat) y cada país se arma encadenándolas: así dos vecinos
// comparten exactamente el mismo borde. Proyección equirectangular simple (con x algo comprimido).

type Pt = [lon: number, lat: number];

const LON0 = -82;
const LAT0 = 13;
const ESCALA_X = 9.4; // ≈ cos(20°) × 10: corrige el estiramiento horizontal a estas latitudes
const ESCALA_Y = 10;

export const MAPA_VIEWBOX = { ancho: 450, alto: 690 };

// ---------------------------------------------------------------- Costas (sentido horario)
const COSTA: Record<string, Pt[]> = {
  colombiaCaribe: [[-77.4, 8.7], [-76.0, 9.4], [-75.5, 10.4], [-74.8, 11.0], [-73.2, 11.3], [-71.7, 12.4], [-71.3, 11.8]],
  venezuela: [[-71.3, 11.8], [-71.6, 10.9], [-70.2, 11.6], [-68.3, 10.6], [-66.9, 10.6], [-64.2, 10.6], [-62.0, 10.7], [-60.8, 8.6], [-60.0, 8.5]],
  guyana: [[-60.0, 8.5], [-58.2, 6.8], [-57.1, 5.9]],
  surinam: [[-57.1, 5.9], [-55.2, 5.9], [-54.0, 5.7]],
  guayanaFrancesa: [[-54.0, 5.7], [-52.3, 4.9], [-51.6, 4.2]],
  brasil: [
    [-51.6, 4.2], [-50.0, 1.8], [-49.3, -0.2], [-48.4, -1.4], [-44.3, -2.5], [-41.5, -2.9], [-38.5, -3.7], [-35.2, -5.4],
    [-34.8, -7.5], [-35.6, -9.7], [-38.5, -13.0], [-39.0, -17.8], [-40.3, -20.3], [-42.0, -23.0], [-44.5, -23.3],
    [-46.3, -24.0], [-48.5, -26.5], [-48.6, -28.5], [-50.5, -30.8], [-52.1, -32.2], [-53.4, -33.7],
  ],
  uruguay: [[-53.4, -33.7], [-54.9, -34.9], [-56.2, -34.9], [-57.8, -34.4], [-58.4, -33.9]],
  argentina: [
    [-58.4, -33.9], [-58.5, -34.5], [-57.3, -35.8], [-57.5, -38.0], [-60.0, -38.9], [-62.3, -38.8], [-62.2, -40.6],
    [-65.0, -40.8], [-64.0, -42.6], [-65.2, -44.5], [-66.9, -45.2], [-67.6, -46.4], [-65.8, -47.8], [-67.7, -49.5],
    [-68.9, -51.6], [-68.4, -52.3],
  ],
  chile: [
    [-68.4, -52.3], [-70.9, -53.0], [-72.6, -53.6], [-74.6, -52.0], [-75.4, -48.5], [-74.7, -46.0], [-74.0, -43.5],
    [-73.7, -41.8], [-73.6, -39.0], [-73.2, -37.0], [-72.4, -35.0], [-71.6, -33.0], [-71.5, -30.0], [-71.3, -28.5],
    [-70.6, -26.0], [-70.4, -23.5], [-70.1, -21.0], [-70.4, -18.35],
  ],
  peru: [[-70.4, -18.35], [-71.5, -17.4], [-74.0, -15.9], [-76.3, -13.8], [-77.1, -12.1], [-78.7, -9.0], [-79.9, -6.8], [-81.3, -4.7], [-80.3, -3.4]],
  ecuador: [[-80.3, -3.4], [-80.0, -2.6], [-80.9, -2.2], [-80.4, -0.6], [-80.1, 0.8], [-78.9, 1.45]],
  colombiaPacifico: [[-78.9, 1.45], [-78.6, 2.5], [-77.4, 3.9], [-77.4, 6.0], [-77.9, 7.2], [-77.4, 8.7]],
};

// ---------------------------------------------------------------- Fronteras terrestres
const FRONTERA: Record<string, Pt[]> = {
  colombiaVenezuela: [[-71.3, 11.8], [-72.3, 11.1], [-72.9, 9.3], [-72.4, 7.4], [-70.0, 7.0], [-67.5, 6.2], [-67.6, 3.5], [-66.9, 1.2]],
  venezuelaBrasil: [[-66.9, 1.2], [-65.5, 0.7], [-63.4, 2.2], [-64.6, 4.1], [-62.8, 4.0], [-60.7, 5.2]],
  venezuelaGuyana: [[-60.7, 5.2], [-61.3, 6.7], [-60.0, 8.5]],
  guyanaBrasil: [[-60.7, 5.2], [-59.6, 3.5], [-59.7, 1.8], [-58.0, 1.3], [-56.5, 1.9]],
  guyanaSurinam: [[-56.5, 1.9], [-57.2, 3.5], [-57.1, 5.9]],
  surinamBrasil: [[-56.5, 1.9], [-55.0, 2.5], [-54.1, 2.1]],
  surinamGuayanaFrancesa: [[-54.1, 2.1], [-54.4, 3.8], [-54.0, 5.7]],
  guayanaFrancesaBrasil: [[-54.1, 2.1], [-52.9, 2.2], [-51.6, 4.2]],
  colombiaBrasil: [[-66.9, 1.2], [-69.6, 1.2], [-69.4, -1.0], [-69.95, -4.2]],
  colombiaPeru: [[-69.95, -4.2], [-72.9, -2.4], [-75.2, -0.1]],
  colombiaEcuador: [[-75.2, -0.1], [-77.4, 0.4], [-78.9, 1.45]],
  ecuadorPeru: [[-75.2, -0.1], [-76.9, -2.4], [-78.6, -4.6], [-80.0, -4.3], [-80.3, -3.4]],
  peruBrasil: [[-69.95, -4.2], [-73.1, -7.4], [-72.7, -9.4], [-70.6, -9.5], [-69.6, -10.95]],
  peruBolivia: [[-69.6, -10.95], [-68.7, -12.6], [-69.4, -15.3], [-69.5, -17.5]],
  peruChile: [[-69.5, -17.5], [-70.4, -18.35]],
  boliviaChile: [[-69.5, -17.5], [-68.5, -19.3], [-67.9, -21.5], [-67.2, -22.8]],
  boliviaArgentina: [[-67.2, -22.8], [-65.7, -22.1], [-64.3, -22.8], [-62.6, -22.2]],
  boliviaParaguay: [[-62.6, -22.2], [-61.8, -19.6], [-59.1, -19.3], [-58.2, -20.0]],
  boliviaBrasil: [[-69.6, -10.95], [-65.4, -9.7], [-63.5, -12.5], [-60.3, -15.1], [-58.4, -16.3], [-57.6, -18.2], [-58.2, -20.0]],
  paraguayBrasil: [[-58.2, -20.0], [-57.9, -22.1], [-55.7, -22.4], [-55.4, -24.0], [-54.6, -25.6]],
  paraguayArgentina: [[-62.6, -22.2], [-59.5, -24.3], [-57.6, -25.4], [-58.6, -27.3], [-55.8, -27.4], [-54.6, -25.6]],
  argentinaBrasil: [[-54.6, -25.6], [-53.7, -26.8], [-55.8, -28.5], [-57.6, -30.2]],
  uruguayBrasil: [[-57.6, -30.2], [-55.6, -30.9], [-53.3, -32.5], [-53.4, -33.7]],
  uruguayArgentina: [[-57.6, -30.2], [-58.1, -32.0], [-58.4, -33.9]],
  argentinaChile: [
    [-67.2, -22.8], [-68.3, -24.4], [-68.6, -27.0], [-69.9, -30.0], [-70.0, -32.6], [-70.5, -36.0], [-71.0, -39.5],
    [-71.8, -42.0], [-71.7, -45.0], [-72.4, -48.0], [-73.3, -50.0], [-72.3, -51.6], [-69.5, -52.1], [-68.4, -52.3],
  ],
};

// Isla del extremo sur, repartida en dos (esquemático).
const ISLA_SUR_ESTE: Pt[] = [[-68.6, -52.65], [-67.2, -53.6], [-65.3, -54.7], [-66.5, -55.0], [-68.6, -54.9]];
const ISLA_SUR_OESTE: Pt[] = [[-68.6, -52.65], [-68.6, -54.9], [-70.0, -55.1], [-71.8, -54.3], [-70.4, -53.3], [-69.4, -52.6]];

// ---------------------------------------------------------------- Armado

/** Tramo: costa o frontera, en su sentido o invertida ('-' adelante). */
type Tramo = string;

function puntos(tramo: Tramo): Pt[] {
  const inv = tramo.startsWith('-');
  const [tipo, nombre] = (inv ? tramo.slice(1) : tramo).split('.') as [string, string];
  const pts = (tipo === 'c' ? COSTA : FRONTERA)[nombre];
  if (!pts) throw new Error(`Tramo de mapa inexistente: ${tramo}`);
  return inv ? [...pts].reverse() : pts;
}

const proyectar = ([lon, lat]: Pt): [number, number] => [
  Math.round((lon - LON0) * ESCALA_X * 10) / 10,
  Math.round((LAT0 - lat) * ESCALA_Y * 10) / 10,
];

function anillo(pts: Pt[]): string {
  // Los tramos encadenados repiten el punto de unión: se descarta el duplicado.
  const limpio = pts.filter((p, i) => i === 0 || !igual(p, pts[i - 1]!));
  return 'M' + limpio.map((p) => proyectar(p).join(',')).join('L') + 'Z';
}

const igual = (a: Pt, b: Pt) => a[0] === b[0] && a[1] === b[1];

/** Encadena tramos; cada uno debe empezar donde terminó el anterior y el último cerrar el anillo. */
function armar(...tramos: Tramo[]): string {
  const partes = tramos.map(puntos);
  partes.forEach((p, i) => {
    const prev = partes[(i + partes.length - 1) % partes.length]!;
    if (!igual(prev.at(-1)!, p[0]!)) throw new Error(`Mapa: el tramo ${tramos[i]} no continúa al anterior`);
  });
  return anillo(partes.flat());
}

export interface FormaPais {
  /** Atributo `d` del path SVG. */
  d: string;
  /** Punto de la etiqueta (y del área táctil), en coordenadas del viewBox. */
  etiqueta: [number, number];
  /** Abreviatura para la etiqueta del mapa (el nombre completo va en el aria-label). */
  abrev: string;
}

const forma = (abrev: string, lonLat: Pt, ...anillos: string[]): FormaPais => ({ d: anillos.join(''), etiqueta: proyectar(lonLat), abrev });

/** Los 12 países soberanos (ids de `geografia.json`). */
export const MAPA_PAISES: Record<string, FormaPais> = {
  colombia: forma('COL', [-73.6, 4.2], armar('c.colombiaCaribe', 'f.colombiaVenezuela', 'f.colombiaBrasil', 'f.colombiaPeru', 'f.colombiaEcuador', 'c.colombiaPacifico')),
  venezuela: forma('VEN', [-66.2, 7.4], armar('c.venezuela', '-f.venezuelaGuyana', '-f.venezuelaBrasil', '-f.colombiaVenezuela')),
  guyana: forma('GUY', [-58.9, 5.0], armar('c.guyana', '-f.guyanaSurinam', '-f.guyanaBrasil', 'f.venezuelaGuyana')),
  surinam: forma('SUR', [-55.7, 4.0], armar('c.surinam', '-f.surinamGuayanaFrancesa', '-f.surinamBrasil', 'f.guyanaSurinam')),
  brasil: forma(
    'BRA',
    [-50.5, -11.0],
    armar(
      'c.brasil',
      '-f.uruguayBrasil',
      '-f.argentinaBrasil',
      '-f.paraguayBrasil',
      '-f.boliviaBrasil',
      '-f.peruBrasil',
      '-f.colombiaBrasil',
      'f.venezuelaBrasil',
      'f.guyanaBrasil',
      'f.surinamBrasil',
      'f.guayanaFrancesaBrasil',
    ),
  ),
  ecuador: forma('ECU', [-78.4, -1.6], armar('c.ecuador', '-f.colombiaEcuador', 'f.ecuadorPeru')),
  peru: forma('PER', [-75.2, -9.6], armar('c.peru', '-f.ecuadorPeru', '-f.colombiaPeru', 'f.peruBrasil', 'f.peruBolivia', 'f.peruChile')),
  bolivia: forma('BOL', [-64.6, -16.8], armar('f.peruBolivia', 'f.boliviaChile', 'f.boliviaArgentina', 'f.boliviaParaguay', '-f.boliviaBrasil')),
  paraguay: forma('PAR', [-58.6, -23.0], armar('f.boliviaParaguay', 'f.paraguayBrasil', '-f.paraguayArgentina')),
  chile: forma('CHI', [-74.6, -29.0], armar('c.chile', '-f.peruChile', 'f.boliviaChile', 'f.argentinaChile'), anillo(ISLA_SUR_OESTE)),
  argentina: forma(
    'ARG',
    [-65.4, -35.5],
    armar('c.argentina', '-f.argentinaChile', 'f.boliviaArgentina', 'f.paraguayArgentina', 'f.argentinaBrasil', 'f.uruguayArgentina'),
    anillo(ISLA_SUR_ESTE),
  ),
  uruguay: forma('URU', [-56.0, -32.6], armar('c.uruguay', '-f.uruguayArgentina', 'f.uruguayBrasil')),
};

/** Territorio no soberano (no es uno de los 12): se dibuja neutro y sin interacción. */
export const MAPA_OTROS: string[] = [armar('c.guayanaFrancesa', '-f.guayanaFrancesaBrasil', 'f.surinamGuayanaFrancesa')];

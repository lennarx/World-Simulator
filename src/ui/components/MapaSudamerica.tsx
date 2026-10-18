// Mapa esquemático de la región: color por relación y marcas de crisis, guerra y tratados.
// Cada país es un botón accesible (Tab + Enter/Espacio); la lista de "Relaciones" sigue siendo la alternativa textual.
import type { KeyboardEvent } from 'react';
import { MAPA_OTROS, MAPA_PAISES, MAPA_VIEWBOX } from '../../data/mapa';
import { nombrePais, situacionPais, type GameState, type SituacionPais } from '../../engine';
import { fmt } from '../format';

/** Relleno según la relación: mezcla hacia verde (buena) o rojo (mala) sobre el color de la tierra. */
function relleno(sit: SituacionPais): string {
  if (sit.esJugador) return 'var(--color-brand)';
  const intensidad = Math.round((Math.min(100, Math.abs(sit.relacion)) / 100) * 70);
  const tono = sit.relacion >= 0 ? 'var(--color-good)' : 'var(--color-bad)';
  return `color-mix(in oklab, ${tono} ${intensidad}%, var(--color-map-land))`;
}

export function describirPais(sit: SituacionPais): string {
  if (sit.esJugador) return `${nombrePais(sit.id)} (tu país)`;
  const partes = [`${nombrePais(sit.id)}, relación ${fmt(sit.relacion, 0)}`];
  if (sit.vecino) partes.push('vecino');
  if (sit.guerra) partes.push('en guerra');
  if (sit.crisis) partes.push(`crisis de frontera nivel ${sit.crisis}`);
  if (sit.tratados.length) partes.push(`${sit.tratados.length} tratado/s`);
  return partes.join(', ');
}

interface Props {
  game: GameState;
  seleccionado?: string | null;
  /** Sin esto el mapa es solo de lectura (Panel, Final). */
  onSeleccionar?: (id: string) => void;
  compacto?: boolean;
}

export function MapaSudamerica({ game, seleccionado = null, onSeleccionar, compacto = false }: Props) {
  const interactivo = !!onSeleccionar;
  const ids = Object.keys(MAPA_PAISES);
  const situaciones = Object.fromEntries(ids.map((id) => [id, situacionPais(game, id)]));
  const conflictos = ids.filter((id) => situaciones[id]!.guerra || situaciones[id]!.crisis);
  const resumen = conflictos.length
    ? `Mapa de la región. Situaciones abiertas: ${conflictos.map((id) => describirPais(situaciones[id]!)).join('; ')}.`
    : 'Mapa de la región. Sin crisis ni guerras abiertas.';

  const teclado = (id: string) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSeleccionar?.(id);
    }
  };

  return (
    <svg
      className={`mapa${compacto ? ' compacto' : ''}`}
      viewBox={`0 0 ${MAPA_VIEWBOX.ancho} ${MAPA_VIEWBOX.alto}`}
      role={interactivo ? 'group' : 'img'}
      aria-label={resumen}
    >
      <title>{resumen}</title>
      <defs>
        <pattern id="mapa-rayado-crisis" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="var(--color-warn)" strokeWidth="3" />
        </pattern>
        <pattern id="mapa-rayado-guerra" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--color-bad)" strokeWidth="3" />
        </pattern>
      </defs>
      <rect width={MAPA_VIEWBOX.ancho} height={MAPA_VIEWBOX.alto} className="mapa-mar" />
      {MAPA_OTROS.map((d, i) => (
        <path key={i} d={d} className="mapa-otro" aria-hidden="true" />
      ))}
      {ids.map((id) => {
        const f = MAPA_PAISES[id]!;
        const sit = situaciones[id]!;
        const [lx, ly] = f.etiqueta;
        const sel = seleccionado === id;
        const marca = sit.guerra ? 'url(#mapa-rayado-guerra)' : sit.crisis ? 'url(#mapa-rayado-crisis)' : null;
        return (
          <g
            key={id}
            className={`mapa-pais${sel ? ' sel' : ''}${sit.guerra ? ' guerra' : sit.crisis ? ' crisis' : ''}`}
            {...(interactivo
              ? {
                  role: 'button',
                  tabIndex: 0,
                  'aria-label': describirPais(sit),
                  'aria-pressed': sel,
                  onClick: () => onSeleccionar(id),
                  onKeyDown: teclado(id),
                }
              : { 'aria-hidden': true })}
          >
            <path d={f.d} className="forma" style={{ fill: relleno(sit) }} />
            {marca && <path d={f.d} fill={marca} className="marca" />}
            {/* Área táctil mínima para los países chicos. */}
            {interactivo && <circle cx={lx} cy={ly} r={22} className="tactil" />}
            <text x={lx} y={ly} className={`etiqueta${sit.esJugador ? ' propia' : ''}`}>
              {sit.esJugador ? 'VOS' : f.abrev}
            </text>
            {!compacto && sit.crisis && !sit.guerra && (
              <text x={lx} y={ly + 13} className="etiqueta detalle">
                crisis {sit.crisis}/3
              </text>
            )}
            {!compacto && sit.guerra && (
              <text x={lx} y={ly + 13} className="etiqueta detalle">
                guerra
              </text>
            )}
            {sit.tratados.map((t, i) => (
              <circle key={t} cx={lx - (sit.tratados.length - 1) * 4 + i * 8} cy={ly - 15} r={3} className="tratado" />
            ))}
          </g>
        );
      })}
      {/* Contorno del seleccionado encima de todo, para que no lo tapen los vecinos. */}
      {seleccionado && MAPA_PAISES[seleccionado] && <path d={MAPA_PAISES[seleccionado].d} className="mapa-contorno-sel" aria-hidden="true" />}
    </svg>
  );
}

/** Leyenda en HTML (fuera del SVG, para que se lea bien con lector de pantalla). */
export function LeyendaMapa() {
  return (
    <ul className="mapa-leyenda small" aria-label="Referencias del mapa">
      <li>
        <span className="muestra" style={{ background: 'var(--color-brand)' }} /> Tu país
      </li>
      <li>
        <span className="muestra" style={{ background: 'color-mix(in oklab, var(--color-good) 70%, var(--color-map-land))' }} /> Buena relación
      </li>
      <li>
        <span className="muestra" style={{ background: 'color-mix(in oklab, var(--color-bad) 70%, var(--color-map-land))' }} /> Mala relación
      </li>
      <li>
        <span className="muestra rayada crisis" /> Crisis de frontera
      </li>
      <li>
        <span className="muestra rayada guerra" /> Guerra
      </li>
      <li>
        <span className="muestra punto" /> Tratado vigente (uno por tratado)
      </li>
    </ul>
  );
}

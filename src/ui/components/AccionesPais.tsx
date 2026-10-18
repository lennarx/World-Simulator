// Botones de acción sobre un país (visita, cooperar, protestar, gesto, proponer tratado, declarar guerra).
// Los usan la lista de relaciones y la ficha del mapa en la pestaña Exterior.
import { CFG } from '../../data/config';
import { nombrePais, puedeFirmar, territorioDe, type TipoAccion, type TipoTratado } from '../../engine';
import { useGame } from '../store';

export const ACCIONES: { tipo: TipoAccion; label: string; ayuda: string }[] = [
  { tipo: 'visita', label: 'Visita', ayuda: 'Mejora la relación (rinde menos si ya es buena).' },
  { tipo: 'cooperacion', label: 'Cooperar', ayuda: 'Seguridad conjunta: relación y algo de estabilidad. Requiere relación ≥ 0.' },
  { tipo: 'protesta', label: 'Protestar', ayuda: 'Baja la relación. En plena crisis con ese país, suma aprobación.' },
  { tipo: 'gesto', label: 'Gesto', ayuda: 'Discurso duro: sube tu aprobación, baja la relación.' },
  { tipo: 'devolver', label: 'Devolver territorio', ayuda: 'Terminás la ocupación: mejora mucho la relación y la región lo celebra, pero puertas adentro cuesta aprobación.' },
  {
    tipo: 'reclamar',
    label: 'Reclamar territorio',
    ayuda: `Pedís que te devuelvan la franja ocupada. Requiere relación ≥ ${CFG.guerra.reclamar.relacionMin}; cuanto mejor la relación, más chances.`,
  },
];

export const NOMBRE_TRATADO: Record<TipoTratado, string> = {
  comercio: 'Comercio',
  defensa: 'Defensa',
  integracion: 'Integración',
};

interface Props {
  id: string;
  tipoTratado: TipoTratado;
  onDeclararGuerra: (id: string) => void;
}

export function AccionesPais({ id, tipoTratado, onDeclararGuerra }: Props) {
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const setDraft = useGame((s) => s.setDraft);
  const max = CFG.diplomacia.accionesPorTurno;
  const usadas = draft.diplomacia.length;
  const declaracion = draft.guerra.declarar;
  const firma = puedeFirmar(game, tipoTratado, id);
  // Las acciones territoriales solo aparecen si hay territorio en juego con ese país.
  const visibles = ACCIONES.filter(
    (a) => (a.tipo !== 'devolver' || !!territorioDe(game, game.paisId, id)) && (a.tipo !== 'reclamar' || !!territorioDe(game, id, game.paisId)),
  );

  return (
    <div className="row small" style={{ gap: 6 }}>
      {visibles.map((a) => (
        <button
          key={a.tipo}
          type="button"
          title={a.ayuda}
          disabled={usadas >= max}
          onClick={() => usadas < max && setDraft({ diplomacia: [...draft.diplomacia, { tipo: a.tipo, con: id }] })}
          aria-label={`${a.label} con ${nombrePais(id)}. ${a.ayuda}`}
        >
          {a.label}
        </button>
      ))}
      <button
        type="button"
        className="primary"
        disabled={!firma.ok}
        title={firma.ok ? `Proponer ${NOMBRE_TRATADO[tipoTratado]}` : firma.motivo}
        aria-label={firma.ok ? `Proponer tratado de ${NOMBRE_TRATADO[tipoTratado]} con ${nombrePais(id)}` : `No se puede proponer: ${firma.motivo}`}
        onClick={() => setDraft({ tratado: { tipo: tipoTratado, con: id }, ley: null, guerra: { ...draft.guerra, declarar: null } })}
      >
        Proponer
      </button>
      <button
        type="button"
        disabled={!!game.guerra || !!declaracion}
        onClick={() => onDeclararGuerra(id)}
        aria-label={`Declarar la guerra a ${nombrePais(id)}…`}
        title={game.guerra ? 'Ya hay un conflicto en curso.' : undefined}
        style={{ color: 'var(--color-bad)' }}
      >
        Declarar guerra…
      </button>
    </div>
  );
}

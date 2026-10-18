// Diálogo de declaración de guerra. <dialog> nativo: foco atrapado y Escape para cerrar.
import { useEffect, useRef, useState } from 'react';
import { CFG } from '../../data/config';
import { capacidadPais, esVecino, frentesDisponibles, nombrePais, votosAutorizacion } from '../../engine';
import { fmt } from '../format';
import { useGame } from '../store';

const NOMBRE_FRENTE = { aire: 'aéreo', mar: 'naval', frontera: 'terrestre' } as const;

export function DeclararGuerraDialog({ contra, onClose }: { contra: string | null; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const setDraft = useGame((s) => s.setDraft);
  const [siRechaza, setSiRechaza] = useState<'desistir' | 'avanzar'>('desistir');

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (contra && !d.open) {
      d.showModal?.();
      // Foco en la opción segura por defecto.
      cancelar.current?.focus();
    }
    if (!contra && d.open) d.close();
  }, [contra]);

  if (!contra) return <dialog ref={ref} />;
  const nombre = nombrePais(contra);
  const votos = votosAutorizacion(game, contra, draft.concesiones);
  const frentes = frentesDisponibles(game.paisId, contra);
  const D = CFG.guerra.declarar;

  return (
    <dialog ref={ref} onClose={onClose} aria-labelledby="dlg-guerra-titulo" className="card" style={{ maxWidth: 520, width: 'calc(100% - 32px)', color: 'var(--color-text)' }}>
      <div className="stack">
        <h2 id="dlg-guerra-titulo">¿Declarar la guerra a {nombre}?</h2>
        <p>Una guerra tiene costos humanos irreparables. Antes de decidir, estos son los efectos esperados:</p>
        <ul className="small" style={{ margin: 0, paddingLeft: 18 }}>
          <li>Relación con {nombre}: −100. El resto de la región empeora su relación (más los vecinos de {nombre} y tus aliados).</li>
          <li>Se suspenden los tratados con {nombre}. Posibles sanciones comerciales.</li>
          <li>Reservas −{fmt(-D.reservas)} meses y suba de la prima de riesgo. El gasto en defensa pasa a un piso de ×{CFG.guerra.multDefensaGuerra}.</li>
          <li>Cada trimestre: menos crecimiento, reservas y estabilidad; costo humano creciente; la aprobación inicial se desgasta.</li>
          <li>
            Frentes posibles: {frentes.map((f) => NOMBRE_FRENTE[f]).join(', ')}. Fuerzas propias {fmt(game.ind.capacidadMilitar, 0)} vs. {fmt(capacidadPais(contra), 0)}.
          </li>
          <li>
            {esVecino(game.paisId, contra)
              ? `Territorio en juego: si ganás, te quedás con una franja junto a la frontera (rinde crecimiento, recaudación y reservas, pero cuesta resistencia, guarnición y aislamiento). Si perdés, la franja la pierde tu país.`
              : `Sin frontera común: no se disputa territorio.`}
          </li>
          <li>Una derrota multiplica el riesgo de quiebre institucional.</li>
        </ul>
        <p>
          El Congreso debe autorizarla. Votos esperados: <strong className={votos.si / votos.total > 0.5 ? 'good' : 'bad'}>{fmt(votos.si, 0)}</strong> de{' '}
          {votos.total}. Ocupa la votación del trimestre (reemplaza ley y tratado).
        </p>
        <div role="radiogroup" aria-label="Si el Congreso la rechaza" className="stack" style={{ gap: 0 }}>
          <label className="option">
            <input type="radio" name="siRechaza" checked={siRechaza === 'desistir'} onChange={() => setSiRechaza('desistir')} />
            <span>Si el Congreso la rechaza, desistir.</span>
          </label>
          <label className="option">
            <input type="radio" name="siRechaza" checked={siRechaza === 'avanzar'} onChange={() => setSiRechaza('avanzar')} />
            <span>
              Avanzar igual por decreto <span className="small bad">(gobernabilidad −{CFG.guerra.autorizacion.castigoDecreto} y riesgo de juicio político)</span>
            </span>
          </label>
        </div>
        <div className="row">
          <button ref={cancelar} type="button" onClick={() => ref.current?.close()}>
            Cancelar
          </button>
          <button
            type="button"
            className="primary"
            style={{ background: 'var(--color-bad)' }}
            onClick={() => {
              setDraft({ guerra: { ...draft.guerra, declarar: contra, siRechaza }, ley: null, tratado: null });
              ref.current?.close();
            }}
          >
            Incluir la declaración en este trimestre
          </button>
        </div>
      </div>
    </dialog>
  );
}

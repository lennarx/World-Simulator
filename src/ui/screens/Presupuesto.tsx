import { CFG } from '../../data/config';
import { AREAS, previewFiscal, type AreaId, type Financiamiento } from '../../engine';
import { AREAS_NOMBRE, fmt } from '../format';
import { useGame } from '../store';

const PASO = 0.1;

function Control({ id, label, value, base, max, onChange, hint }: { id: string; label: string; value: number; base: number; max: number; onChange: (v: number) => void; hint?: string }) {
  const diff = value - base;
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row spread">
        <label htmlFor={id}>{label}</label>
        <span className="small">
          <input
            type="number"
            min={0}
            max={max}
            step={PASO}
            value={Number(value.toFixed(2))}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={`${label} en % del PBI`}
            style={{ width: 80 }}
          />{' '}
          % PBI{' '}
          <span className={Math.abs(diff) < 0.05 ? 'muted' : diff > 0 ? 'good' : 'bad'}>
            ({diff >= 0 ? '+' : ''}
            {fmt(diff)} vs. base)
          </span>
        </span>
      </div>
      <input id={id} type="range" min={0} max={max} step={PASO} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      {hint && <span className="small muted">{hint}</span>}
    </div>
  );
}

const AYUDAS: Partial<Record<AreaId, string>> = {
  infraestructura: 'Empuja el crecimiento con retardo.',
  educacion: 'Algo de crecimiento a largo plazo y algo de aprobación.',
  asistencia: 'Aprobación y paz social rápidas. Cara.',
  energia: 'Subsidios populares; recortar mucho trae apagones.',
  seguridad: 'Estabilidad y aprobación. Recortar trae olas de inseguridad.',
  defensa: 'Sube la capacidad militar (lento). Desfinanciar a las FF.AA. aumenta el riesgo institucional. En guerra o con territorio ocupado (guarnición) tiene un piso obligatorio.',
  salud: 'Aprobación y estabilidad. Recortar trae brotes sanitarios.',
};

export function Presupuesto() {
  const game = useGame((s) => s.game)!;
  const draft = useGame((s) => s.draft)!;
  const setDraft = useGame((s) => s.setDraft);
  const autoIntereses = useGame((s) => s.autoIntereses);
  const setAutoIntereses = useGame((s) => s.setAutoIntereses);
  const f = previewFiscal(game, draft);
  const base = game.presupuestoBase;

  const setArea = (a: AreaId, v: number) => setDraft({ presupuesto: { ...draft.presupuesto, [a]: Math.max(0, Math.min(CFG.fiscal.areaMax, v || 0)) } });

  return (
    <main className="stack">
      <section className="card stack" aria-live="polite">
        <h2>Cuentas del trimestre</h2>
        <div className="row spread small"><span>Recaudación</span><span>{fmt(f.recaudacion)}% PBI</span></div>
        <div className="row spread small"><span>Gasto primario</span><span>{fmt(f.gastoPrimario)}% PBI</span></div>
        <div className="row spread small"><span>Pago de deuda (mínimo exigible {fmt(f.intereses)})</span><span>{fmt(f.pagoDeuda)}% PBI</span></div>
        {f.concesiones > 0 && <div className="row spread small"><span>Concesiones al Congreso</span><span>{fmt(f.concesiones)}% PBI</span></div>}
        <div className="row spread">
          <strong>{f.deficit >= 0 ? 'Déficit' : 'Superávit'}</strong>
          <strong className={f.deficit > 3 ? 'bad' : f.deficit < 0 ? 'good' : ''}>{fmt(Math.abs(f.deficit))}% PBI</strong>
        </div>
        {f.emision > 0 && <p className="warn small">Se emitirán {fmt(f.emision, 2)}% del PBI este trimestre: ojo con la inflación.</p>}
        {f.enAtraso && <p className="bad small">Pago de deuda por debajo de los intereses: atraso y suba de la prima de riesgo.</p>}
      </section>

      <fieldset className="stack">
        <legend>Gasto por área</legend>
        {AREAS.filter((a) => a !== 'deuda').map((a) => (
          <Control key={a} id={`area-${a}`} label={AREAS_NOMBRE[a]} value={draft.presupuesto[a]} base={base[a]} max={CFG.fiscal.areaMax} onChange={(v) => setArea(a, v)} hint={AYUDAS[a]} />
        ))}
      </fieldset>

      <fieldset className="stack">
        <legend>Deuda</legend>
        <Control id="area-deuda" label={AREAS_NOMBRE.deuda} value={draft.presupuesto.deuda} base={f.intereses} max={CFG.fiscal.areaMax} onChange={(v) => setArea('deuda', v)} hint="Por encima del mínimo, amortizás. Por debajo, entrás en atraso." />
        <div className="row">
          <button type="button" onClick={() => setArea('deuda', Math.ceil(f.intereses * 10) / 10)}>
            Pagar el mínimo
          </button>
          <label className="row small">
            <input type="checkbox" checked={autoIntereses} onChange={(e) => setAutoIntereses(e.target.checked)} />
            Ajustar al mínimo automáticamente cada trimestre
          </label>
        </div>
      </fieldset>

      <fieldset className="stack">
        <legend>Ingresos y financiamiento</legend>
        <Control id="impuestos" label="Presión impositiva (recaudación)" value={draft.impuestos} base={game.impuestosBase} max={CFG.fiscal.impuestosMax} onChange={(v) => setDraft({ impuestos: Math.max(CFG.fiscal.impuestosMin, Math.min(CFG.fiscal.impuestosMax, v || 0)) })} hint="Subir impuestos frena el crecimiento y la aprobación." />
        <div role="radiogroup" aria-label="Financiamiento del déficit" className="stack" style={{ gap: 0 }}>
          {(
            [
              ['deuda', 'Deuda', 'Sube la deuda y, con ella, la prima de riesgo.'],
              ['emision', 'Emisión', 'No suma deuda, pero sube la inflación y baja las reservas.'],
              ['mixto', 'Mixto', 'Mitad y mitad.'],
            ] as [Financiamiento, string, string][]
          ).map(([v, t, d]) => (
            <label key={v} className="option">
              <input type="radio" name="fin" value={v} checked={draft.financiamiento === v} onChange={() => setDraft({ financiamiento: v })} />
              <span>
                <strong>{t}</strong>
                <br />
                <span className="small muted">{d}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <button type="button" onClick={() => setDraft({ presupuesto: { ...game.presupuesto }, impuestos: game.impuestos, financiamiento: game.financiamiento })}>
        Deshacer cambios del trimestre
      </button>
    </main>
  );
}

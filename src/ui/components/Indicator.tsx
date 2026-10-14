import type { IndicadorId } from '../../engine';
import { fmt, INDICADORES } from '../format';

export function Indicator({ id, valor, anterior }: { id: IndicadorId; valor: number; anterior?: number }) {
  const meta = INDICADORES[id];
  const delta = anterior === undefined ? 0 : valor - anterior;
  const mejora = meta.subirEsBueno ? delta > 0 : delta < 0;
  const clase = Math.abs(delta) < 0.05 ? 'muted' : mejora ? 'good' : 'bad';
  const flecha = Math.abs(delta) < 0.05 ? '=' : delta > 0 ? '▲' : '▼';
  return (
    <div className="card indicator" title={meta.ayuda}>
      <div className="small muted">{meta.nombre}</div>
      <div className="valor">{fmt(valor)}</div>
      <div className="small">
        <span className="muted">{meta.unidad}</span>{' '}
        {anterior !== undefined && (
          <span className={clase} aria-label={`variación ${fmt(delta)}`}>
            {flecha} {fmt(Math.abs(delta))}
          </span>
        )}
      </div>
    </div>
  );
}

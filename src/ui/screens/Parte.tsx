import { Tag } from '../components/Tag';
import { trimestre } from '../format';
import { useGame } from '../store';

export function Parte() {
  const partes = useGame((s) => s.partes);
  const game = useGame((s) => s.game)!;
  const irA = useGame((s) => s.irA);
  const ultimo = partes.at(-1);
  const anteriores = partes.slice(0, -1).reverse();

  return (
    <main className="stack">
      {ultimo ? (
        <section className="card stack" aria-labelledby="parte-titulo">
          <h2 id="parte-titulo">Parte del trimestre · {trimestre(ultimo.turno)}</h2>
          {ultimo.entradas.length === 0 && <p className="muted">Trimestre tranquilo. Sospechosamente tranquilo.</p>}
          <div>
            {ultimo.entradas.map((e, i) => (
              <div key={i} className="report-entry">
                <Tag tag={e.tag} />
                <span>{e.texto}</span>
              </div>
            ))}
          </div>
          <button type="button" className="primary" autoFocus onClick={() => irA(game.final ? 'final' : 'panel')}>
            {game.final ? 'Ver el final' : 'Seguir gobernando'}
          </button>
        </section>
      ) : (
        <p className="muted">Todavía no cerraste ningún trimestre.</p>
      )}
      {anteriores.length > 0 && (
        <details className="card">
          <summary>Partes anteriores</summary>
          {anteriores.map((p) => (
            <div key={p.turno} style={{ marginTop: 10 }}>
              <h3>{trimestre(p.turno)}</h3>
              {p.entradas.map((e, i) => (
                <div key={i} className="report-entry">
                  <Tag tag={e.tag} />
                  <span className="small">{e.texto}</span>
                </div>
              ))}
            </div>
          ))}
        </details>
      )}
    </main>
  );
}

import { useRef, useState } from 'react';
import { TODOS_LOS_PAISES } from '../../data/countries';
import { IllustrativeBadge } from '../components/IllustrativeBadge';
import { cargarLocal, leerArchivo } from '../save';
import { useGame } from '../store';

export function Inicio() {
  const nuevaPartida = useGame((s) => s.nuevaPartida);
  const cargarDesde = useGame((s) => s.cargarDesde);
  const continuar = useGame((s) => s.continuar);
  const [semilla, setSemilla] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardada] = useState(() => cargarLocal());
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <main className="stack">
      <section className="card stack">
        <div className="row spread">
          <h1>Simulador de Gobierno Sudamericano</h1>
          <IllustrativeBadge />
        </div>
        <p>
          Asumís la presidencia por <strong>16 trimestres</strong>. Armá el presupuesto, negociá con el Congreso y aguantá los
          imprevistos. Al final te espera el juicio de la historia (y, con suerte, la reelección).
        </p>
        <p className="small muted">
          Todos los números son ilustrativos e inventados para el juego. Los cargos se mencionan por su rol; no hay personas reales.
        </p>
      </section>

      {guardada && (
        <section className="card row spread">
          <span>
            Tenés una partida guardada: <strong>{guardada.state.paisId}</strong>, turno {guardada.state.turno}
            {guardada.state.final ? ' (terminada)' : ''}.
          </span>
          <button type="button" className="primary" onClick={() => continuar()}>
            Continuar
          </button>
        </section>
      )}

      <section aria-labelledby="elegir">
        <h2 id="elegir">Elegí un país</h2>
        <div className="grid-wide">
          {TODOS_LOS_PAISES.map((p) => (
            <button
              key={p.id}
              type="button"
              className="card country"
              disabled={!p.playable}
              onClick={() => nuevaPartida(p.id, semilla)}
              aria-label={p.playable ? `Jugar con ${p.nombre}. ${p.problema}` : `${p.nombre}: próximamente`}
            >
              <strong>{p.nombre}</strong>
              <span className="small muted">{p.playable ? p.problema : `Próximamente · ${p.problema}`}</span>
            </button>
          ))}
        </div>
      </section>

      <details className="card">
        <summary>Opciones</summary>
        <div className="stack" style={{ marginTop: 10 }}>
          <label className="stack">
            <span className="small">Semilla (opcional, para repetir una partida exacta)</span>
            <input type="text" value={semilla} onChange={(e) => setSemilla(e.target.value)} placeholder="ej. asado-2027" />
          </label>
          <div className="row">
            <button type="button" onClick={() => fileRef.current?.click()}>
              Importar partida (JSON)
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              aria-label="Archivo de partida"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                const r = await leerArchivo(f);
                if (typeof r === 'string') setError(r);
                else cargarDesde(r);
                e.target.value = '';
              }}
            />
          </div>
          {error && (
            <p className="bad" role="alert">
              {error}
            </p>
          )}
        </div>
      </details>
    </main>
  );
}

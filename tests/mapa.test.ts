import { describe, expect, it } from 'vitest';
import { TODOS_LOS_PAISES } from '../src/data/countries';
import { MAPA_OTROS, MAPA_PAISES, MAPA_VIEWBOX } from '../src/data/mapa';

const coords = (d: string) => [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])] as const);

describe('mapa esquemático', () => {
  it('tiene exactamente los 12 países soberanos', () => {
    expect(Object.keys(MAPA_PAISES).sort()).toEqual(TODOS_LOS_PAISES.map((p) => p.id).sort());
    expect(Object.keys(MAPA_PAISES)).toHaveLength(12);
  });

  it('todas las formas y etiquetas caen dentro del viewBox', () => {
    const dentro = ([x, y]: readonly [number, number]) => x >= 0 && y >= 0 && x <= MAPA_VIEWBOX.ancho && y <= MAPA_VIEWBOX.alto;
    for (const [id, f] of Object.entries(MAPA_PAISES)) {
      const pts = coords(f.d);
      expect(pts.length, id).toBeGreaterThanOrEqual(3);
      expect(pts.every(dentro), id).toBe(true);
      expect(dentro(f.etiqueta), id).toBe(true);
      expect(f.abrev).toMatch(/^[A-Z]{3}$/);
    }
    for (const t of MAPA_OTROS) {
      expect(coords(t.d).every(dentro), t.id).toBe(true);
      if (t.disputa) expect(dentro(t.disputa.etiqueta), t.id).toBe(true);
    }
  });

  it('las Malvinas aparecen como territorio en disputa, sin asignar a ningún país', () => {
    const malvinas = MAPA_OTROS.find((t) => t.id === 'malvinas');
    expect(malvinas?.disputa?.nota).toMatch(/disputa/i);
    expect(Object.keys(MAPA_PAISES)).not.toContain('malvinas');
  });

  it('los vecinos comparten al menos un vértice de frontera', () => {
    const vertices = (id: string) => new Set(coords(MAPA_PAISES[id]!.d).map(([x, y]) => `${x},${y}`));
    const comparten = (a: string, b: string) => [...vertices(a)].some((v) => vertices(b).has(v));
    expect(comparten('argentina', 'chile')).toBe(true);
    expect(comparten('brasil', 'venezuela')).toBe(true);
    expect(comparten('uruguay', 'brasil')).toBe(true);
    expect(comparten('chile', 'venezuela')).toBe(false);
  });
});

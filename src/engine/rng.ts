// RNG con semilla (mulberry32). El estado es un entero que vive dentro del GameState,
// así una partida guardada sigue exactamente igual al cargarla.

export interface Rng {
  next(): number; // [0, 1)
  range(min: number, max: number): number;
  chance(p: number): boolean;
  /** Aproximación normal (suma de 3 uniformes) centrada en 0 con desvío ~sd. */
  noise(sd: number): number;
  pickWeighted<T>(items: T[], weight: (t: T) => number): T | null;
  /** Estado actual, para guardarlo de vuelta en el GameState. */
  state(): number;
}

export function createRng(seedState: number): Rng {
  let s = seedState >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    chance: (p) => next() < p,
    // Varianza de U(0,1) = 1/12; suma de 3 => 1/4 => sd 0.5. Escalamos a sd pedido.
    noise: (sd) => (next() + next() + next() - 1.5) * 2 * sd,
    pickWeighted(items, weight) {
      const total = items.reduce((acc, it) => acc + Math.max(0, weight(it)), 0);
      if (total <= 0) return null;
      let r = next() * total;
      for (const it of items) {
        r -= Math.max(0, weight(it));
        if (r < 0) return it;
      }
      return items[items.length - 1] ?? null;
    },
    state: () => s,
  };
}

/** Normaliza una semilla cualquiera (número o texto) a uint32. */
export function seedFrom(input: number | string): number {
  if (typeof input === 'number' && Number.isFinite(input)) return input >>> 0;
  const str = String(input);
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

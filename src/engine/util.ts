export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));
/** Acerca `actual` a `objetivo` cerrando la fracción `k` de la distancia. */
export const approach = (actual: number, objetivo: number, k: number) => actual + (objetivo - actual) * k;
export const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d;

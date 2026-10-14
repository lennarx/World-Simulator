import type { EntradaParte } from '../../engine';

const COLORES: Partial<Record<EntradaParte['tag'], string>> = {
  ECONOMÍA: 'var(--color-brand)',
  CONGRESO: 'var(--color-accent)',
  ESCÁNDALO: 'var(--color-bad)',
  FINAL: 'var(--color-bad)',
  PRESIÓN: 'var(--color-warn)',
  DIPLOMACIA: 'var(--color-good)',
};

export function Tag({ tag }: { tag: EntradaParte['tag'] }) {
  return (
    <span className="chip" style={{ borderColor: COLORES[tag], color: COLORES[tag] }}>
      {tag}
    </span>
  );
}

export function Bar({ value, max = 100, label, color }: { value: number; max?: number; label: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="bar" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.round(value)}>
      <span style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

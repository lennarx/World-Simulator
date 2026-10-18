export function IllustrativeBadge({ texto = 'Valores ilustrativos' }: { texto?: string }) {
  return (
    <span className="badge-ilustrativo" title="Los números de este juego son inventados con fines lúdicos. No son datos reales actuales.">
      {texto}
    </span>
  );
}

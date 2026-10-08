// Tooltip compartido: el valor manda, la etiqueta acompaña. Contenido como texto (nunca HTML).
export function ChartTooltip({ x, y, title, rows, align = "center" }) {
  if (x == null) return null;
  return (
    <div
      className="chart-tooltip"
      style={{ left: x, top: y }}
      data-align={align}
      role="presentation"
    >
      {title ? <p className="chart-tooltip-title">{title}</p> : null}
      {rows.map((row) => (
        <p key={row.label} className="chart-tooltip-row">
          {row.key ? (
            <span className="chart-tooltip-key" data-kind={row.key} />
          ) : null}
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </p>
      ))}
    </div>
  );
}

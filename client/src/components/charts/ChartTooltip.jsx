import styles from './Charts.module.css';

// Tooltip compartido: el valor manda, la etiqueta acompaña. Contenido como texto (nunca HTML).
export function ChartTooltip({ x, y, title, rows, align = 'center' }) {
  if (x == null) return null;
  return (
    <div className={styles.tooltip} style={{ left: x, top: y }} data-align={align} role="presentation">
      {title ? <p className={styles.tooltipTitle}>{title}</p> : null}
      {rows.map((row) => (
        <p key={row.label} className={styles.tooltipRow}>
          {row.key ? <span className={styles.tooltipKey} data-kind={row.key} /> : null}
          <strong>{row.value}</strong>
          <span>{row.label}</span>
        </p>
      ))}
    </div>
  );
}

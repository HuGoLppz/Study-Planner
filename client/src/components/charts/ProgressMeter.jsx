import { formatPercent } from '../../utils/format.js';
import styles from './Charts.module.css';

// Parte del total: completadas, pendientes a tiempo y atrasadas. Siempre con leyenda y cifras.
export function ProgressMeter({ completed, pending, overdue, showLegend = true, size = 'md' }) {
  const onTime = Math.max(0, pending - overdue);
  const total = completed + pending;
  const segments = [
    { key: 'done', label: completed === 1 ? 'completada' : 'completadas', value: completed },
    { key: 'pending', label: onTime === 1 ? 'pendiente' : 'pendientes', value: onTime },
    { key: 'overdue', label: overdue === 1 ? 'atrasada' : 'atrasadas', value: overdue },
  ];

  return (
    <figure className={styles.meterFigure}>
      <div
        className={styles.meter}
        data-size={size}
        role="img"
        aria-label={`${completed} completadas, ${onTime} pendientes y ${overdue} atrasadas de ${total} tareas`}
      >
        {total === 0 ? <span className={styles.meterEmpty} /> : null}
        {segments
          .filter((segment) => segment.value > 0)
          .map((segment) => (
            <span
              key={segment.key}
              className={styles.meterSegment}
              data-kind={segment.key}
              style={{ flexGrow: segment.value }}
              title={`${segment.value} ${segment.label}`}
            />
          ))}
      </div>
      {showLegend ? (
        <figcaption className={styles.legend}>
          {segments.map((segment) => (
            <span key={segment.key} className={styles.legendItem}>
              <span className={styles.legendSwatch} data-kind={segment.key} />
              <strong className="tabular">{segment.value}</strong> {segment.label}
            </span>
          ))}
          {total > 0 ? <span className={styles.legendTotal}>{formatPercent(completed / total)} hecho</span> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

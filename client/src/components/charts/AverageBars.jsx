import { useState } from 'react';
import { formatAverage, plural } from '../../utils/format.js';
import { SubjectDot } from '../ui/SubjectTag.jsx';
import { ChartTooltip } from './ChartTooltip.jsx';
import styles from './Charts.module.css';

// Media por asignatura (0–10) con la media general como línea de referencia.
// Una sola serie: todas las barras en el mismo color; la asignatura se identifica por su nombre.
export function AverageBars({ rows, overall }) {
  const [hover, setHover] = useState(null);

  return (
    <figure className={styles.averageFigure}>
      <div className={styles.averageRows} onMouseLeave={() => setHover(null)}>
        {overall != null ? (
          <div className={styles.referenceLine} style={{ '--at': overall / 10 }} aria-hidden>
            <span className={styles.referenceLabel}>Media {formatAverage(overall)}</span>
          </div>
        ) : null}
        {rows.map((row) => {
          const key = row.subject?._id ?? 'none';
          const label = row.subject?.name ?? 'Sin asignatura';
          return (
            <div key={key} className={styles.averageRow}>
              <span className={styles.averageName}>
                <SubjectDot color={row.subject?.color} />
                <span className="truncate">{label}</span>
              </span>
              <span
                className={styles.averageTrack}
                tabIndex={0}
                aria-label={`${label}: media ${formatAverage(row.average)} en ${plural(row.graded, 'tarea', 'tareas')}`}
                onMouseMove={(event) => {
                  const box = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
                  setHover({ row, label, x: event.clientX - box.left, y: event.currentTarget.getBoundingClientRect().top - box.top });
                }}
                onFocus={(event) => {
                  const box = event.currentTarget.parentElement.parentElement.getBoundingClientRect();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHover({ row, label, x: rect.left - box.left + rect.width * (row.average / 10), y: rect.top - box.top });
                }}
                onBlur={() => setHover(null)}
              >
                <span className={styles.averageBar} style={{ width: `${(row.average / 10) * 100}%` }} />
                <span className={styles.averageValue} style={{ left: `${(row.average / 10) * 100}%` }}>
                  {formatAverage(row.average)}
                </span>
              </span>
            </div>
          );
        })}
        <div className={styles.averageAxis} aria-hidden>
          <span />
          <span className={styles.axisTicks}>
            {[0, 5, 10].map((tick) => (
              <span key={tick} style={{ left: `${tick * 10}%` }}>
                {tick}
              </span>
            ))}
          </span>
        </div>
        {hover ? (
          <ChartTooltip
            x={hover.x}
            y={hover.y}
            title={hover.label}
            rows={[
              { label: 'de media', value: formatAverage(hover.row.average) },
              { label: hover.row.graded === 1 ? 'tarea con nota' : 'tareas con nota', value: hover.row.graded },
            ]}
          />
        ) : null}
      </div>
    </figure>
  );
}

import { useState } from 'react';
import { ChartTooltip } from './ChartTooltip.jsx';
import styles from './Charts.module.css';

// Columnas de una sola serie. Etiqueta solo la última y la máxima; el resto, en el tooltip.
export function ColumnChart({ data, formatValue = (value) => value, valueLabel, height = 140, ariaLabel }) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...data.map((item) => item.value));
  const maxIndex = data.findIndex((item) => item.value === max);
  const labelled = new Set([data.length - 1, maxIndex]);

  return (
    <figure className={styles.columnsFigure} aria-label={ariaLabel}>
      <div className={styles.columns} style={{ height }} onMouseLeave={() => setActive(null)}>
        {data.map((item, index) => (
          <div
            key={item.key}
            className={styles.columnSlot}
            tabIndex={0}
            aria-label={`${item.label}: ${formatValue(item.value)} ${valueLabel}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            {labelled.has(index) && item.value > 0 ? (
              <span className={styles.columnValue} style={{ bottom: `calc(${(item.value / max) * 100}% + 4px)` }}>
                {formatValue(item.value)}
              </span>
            ) : null}
            <span
              className={styles.column}
              data-active={active === index || undefined}
              data-empty={item.value === 0 || undefined}
              style={{ height: item.value === 0 ? 2 : `${(item.value / max) * 100}%` }}
            />
          </div>
        ))}
        {active != null ? (
          <ChartTooltip
            x={`${((active + 0.5) / data.length) * 100}%`}
            y={0}
            title={data[active].label}
            rows={[{ label: valueLabel, value: formatValue(data[active].value) }]}
          />
        ) : null}
      </div>
      <div className={styles.columnAxis} aria-hidden>
        {data.map((item) => (
          <span key={item.key}>{item.short}</span>
        ))}
      </div>
    </figure>
  );
}

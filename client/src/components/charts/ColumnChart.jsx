import { useState } from "react";
import { ChartTooltip } from "./ChartTooltip.jsx";

// Columnas de una sola serie. Etiqueta solo la última y la máxima; el resto, en el tooltip.
export function ColumnChart({
  data,
  formatValue = (value) => value,
  valueLabel,
  height = 140,
  ariaLabel,
}) {
  const [active, setActive] = useState(null);
  const max = Math.max(1, ...data.map((item) => item.value));
  const maxIndex = data.findIndex((item) => item.value === max);
  const labelled = new Set([data.length - 1, maxIndex]);

  return (
    <figure className="chart-columns-figure" aria-label={ariaLabel}>
      <div
        className="chart-columns"
        style={{ height }}
        onMouseLeave={() => setActive(null)}
      >
        {data.map((item, index) => (
          <div
            key={item.key}
            className="chart-column-slot"
            tabIndex={0}
            aria-label={`${item.label}: ${formatValue(item.value)} ${valueLabel}`}
            onMouseEnter={() => setActive(index)}
            onFocus={() => setActive(index)}
            onBlur={() => setActive(null)}
          >
            {labelled.has(index) && item.value > 0 ? (
              <span
                className="chart-column-value"
                style={{ bottom: `calc(${(item.value / max) * 100}% + 4px)` }}
              >
                {formatValue(item.value)}
              </span>
            ) : null}
            <span
              className="chart-column"
              data-active={active === index || undefined}
              data-empty={item.value === 0 || undefined}
              style={{
                height: item.value === 0 ? 2 : `${(item.value / max) * 100}%`,
              }}
            />
          </div>
        ))}
        {active != null ? (
          <ChartTooltip
            x={`${((active + 0.5) / data.length) * 100}%`}
            y={0}
            title={data[active].label}
            rows={[
              { label: valueLabel, value: formatValue(data[active].value) },
            ]}
          />
        ) : null}
      </div>
      <div className="chart-column-axis" aria-hidden>
        {data.map((item) => (
          <span key={item.key}>{item.short}</span>
        ))}
      </div>
    </figure>
  );
}

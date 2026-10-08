import { useState } from "react";
import { formatAverage, plural } from "../../utils/format.js";
import { SubjectDot } from "../ui/SubjectTag.jsx";
import { ChartTooltip } from "./ChartTooltip.jsx";

// Media por asignatura (0–10) con la media general como línea de referencia.
// Una sola serie: todas las barras en el mismo color; la asignatura se identifica por su nombre.
export function AverageBars({ rows, overall }) {
  const [hover, setHover] = useState(null);

  return (
    <figure className="chart-average-figure">
      <div className="chart-average-rows" onMouseLeave={() => setHover(null)}>
        {overall != null ? (
          <div
            className="chart-reference-line"
            style={{ "--at": overall / 10 }}
            aria-hidden
          >
            <span className="chart-reference-label">
              Media {formatAverage(overall)}
            </span>
          </div>
        ) : null}
        {rows.map((row) => {
          const key = row.subject?._id ?? "none";
          const label = row.subject?.name ?? "Sin asignatura";
          return (
            <div key={key} className="chart-average-row">
              <span className="chart-average-name">
                <SubjectDot color={row.subject?.color} />
                <span className="truncate">{label}</span>
              </span>
              <span
                className="chart-average-track"
                tabIndex={0}
                aria-label={`${label}: media ${formatAverage(row.average)} en ${plural(row.graded, "tarea", "tareas")}`}
                onMouseMove={(event) => {
                  const box =
                    event.currentTarget.parentElement.parentElement.getBoundingClientRect();
                  setHover({
                    row,
                    label,
                    x: event.clientX - box.left,
                    y:
                      event.currentTarget.getBoundingClientRect().top - box.top,
                  });
                }}
                onFocus={(event) => {
                  const box =
                    event.currentTarget.parentElement.parentElement.getBoundingClientRect();
                  const rect = event.currentTarget.getBoundingClientRect();
                  setHover({
                    row,
                    label,
                    x: rect.left - box.left + rect.width * (row.average / 10),
                    y: rect.top - box.top,
                  });
                }}
                onBlur={() => setHover(null)}
              >
                <span
                  className="chart-average-bar"
                  style={{ width: `${(row.average / 10) * 100}%` }}
                />
                <span
                  className="chart-average-value"
                  style={{ left: `${(row.average / 10) * 100}%` }}
                >
                  {formatAverage(row.average)}
                </span>
              </span>
            </div>
          );
        })}
        <div className="chart-average-axis" aria-hidden>
          <span />
          <span className="chart-axis-ticks">
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
              { label: "de media", value: formatAverage(hover.row.average) },
              {
                label:
                  hover.row.graded === 1 ? "tarea con nota" : "tareas con nota",
                value: hover.row.graded,
              },
            ]}
          />
        ) : null}
      </div>
    </figure>
  );
}

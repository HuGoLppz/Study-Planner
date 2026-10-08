import { useMemo, useState } from "react";
import { useElementSize } from "../../hooks/useUi.js";
import { fmt } from "../../utils/dates.js";
import { formatAverage, formatGrade } from "../../utils/format.js";
import { ChartTooltip } from "./ChartTooltip.jsx";

const HEIGHT = 260;
const PAD = { top: 16, right: 64, bottom: 30, left: 30 };
const TICKS = [0, 2, 4, 6, 8, 10];

// Evolución: cada nota como punto (contexto) y la media acumulada como línea (la historia).
export function EvolutionChart({ points }) {
  const [ref, { width }] = useElementSize();
  const [active, setActive] = useState(null);

  const geometry = useMemo(() => {
    if (!width || points.length === 0) return null;
    const times = points.map((point) => new Date(point.date).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = max - min || 1;
    const innerW = Math.max(40, width - PAD.left - PAD.right);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    const x = (time) =>
      PAD.left +
      (points.length === 1 ? innerW / 2 : ((time - min) / span) * innerW);
    const y = (value) => PAD.top + innerH - (value / 10) * innerH;
    const placed = points.map((point, index) => ({
      ...point,
      cx: x(times[index]),
      sy: y(point.score),
      ay: y(point.runningAverage),
    }));
    const line = placed
      .map(
        (point, index) =>
          `${index === 0 ? "M" : "L"}${point.cx.toFixed(1)},${point.ay.toFixed(1)}`,
      )
      .join(" ");
    return { placed, line, y, innerW };
  }, [points, width]);

  // La cruceta busca el punto más cercano en X: no hay que acertar en el punto.
  const onMove = (event) => {
    if (!geometry) return;
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    let nearest = 0;
    geometry.placed.forEach((point, index) => {
      if (Math.abs(point.cx - px) < Math.abs(geometry.placed[nearest].cx - px))
        nearest = index;
    });
    setActive(nearest);
  };

  const last = geometry?.placed.at(-1);
  const current = active != null ? geometry?.placed[active] : null;

  return (
    <figure className="chart-evolution">
      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-legend-line" />
          Media acumulada
        </span>
        <span className="chart-legend-item">
          <span className="chart-legend-dot" />
          Nota de cada tarea
        </span>
      </div>
      <div ref={ref} className="chart-plot">
        {geometry ? (
          <svg
            width={width}
            height={HEIGHT}
            role="img"
            aria-label={`Evolución de ${points.length} notas; media actual ${formatAverage(last.runningAverage)}`}
            onMouseMove={onMove}
            onMouseLeave={() => setActive(null)}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight")
                setActive((value) =>
                  Math.min(points.length - 1, (value ?? -1) + 1),
                );
              if (event.key === "ArrowLeft")
                setActive((value) => Math.max(0, (value ?? points.length) - 1));
            }}
            onBlur={() => setActive(null)}
          >
            {TICKS.map((tick) => (
              <g key={tick}>
                <line
                  x1={PAD.left}
                  x2={PAD.left + geometry.innerW}
                  y1={geometry.y(tick)}
                  y2={geometry.y(tick)}
                  className="chart-grid-line"
                />
                <text
                  x={PAD.left - 8}
                  y={geometry.y(tick)}
                  className="chart-axis-text"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {tick}
                </text>
              </g>
            ))}
            <text x={PAD.left} y={HEIGHT - 8} className="chart-axis-text">
              {fmt(points[0].date, "d MMM")}
            </text>
            {points.length > 1 ? (
              <text
                x={PAD.left + geometry.innerW}
                y={HEIGHT - 8}
                className="chart-axis-text"
                textAnchor="end"
              >
                {fmt(last.date, "d MMM")}
              </text>
            ) : null}

            {current ? (
              <line
                x1={current.cx}
                x2={current.cx}
                y1={PAD.top}
                y2={HEIGHT - PAD.bottom}
                className="chart-crosshair"
              />
            ) : null}

            {geometry.placed.map((point, index) => (
              <circle
                key={point.taskId}
                cx={point.cx}
                cy={point.sy}
                r={active === index ? 6 : 4.5}
                className="chart-score-dot"
              />
            ))}
            <path d={geometry.line} className="chart-average-line" />
            <circle
              cx={last.cx}
              cy={last.ay}
              r={5}
              className="chart-average-dot"
            />
            <text
              x={last.cx + 10}
              y={last.ay}
              className="chart-end-label"
              dominantBaseline="middle"
            >
              {formatAverage(last.runningAverage)}
            </text>
          </svg>
        ) : (
          <div style={{ height: HEIGHT }} />
        )}
        {current ? (
          <ChartTooltip
            x={current.cx}
            y={Math.min(current.sy, current.ay) - 12}
            title={`${current.title}, ${fmt(current.date, "d MMM yyyy")}`}
            rows={[
              {
                key: "dot",
                label: current.subject?.name ?? "Sin asignatura",
                value: formatGrade(current.score),
              },
              {
                key: "line",
                label: "media acumulada",
                value: formatAverage(current.runningAverage),
              },
            ]}
          />
        ) : null}
      </div>
    </figure>
  );
}

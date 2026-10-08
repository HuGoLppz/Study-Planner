import { Outlet } from "react-router-dom";
import { Logo } from "../components/ui/Logo.jsx";

// Ilustración abstracta: dos semanas de entregas como trazos de fluorescente (sin datos).
function HorizonSketch() {
  const strokes = [
    [0, 0, "yellow"],
    [0, 1, "pink"],
    [2, 0, "blue"],
    [3, 0, "mint"],
    [3, 1, "yellow"],
    [3, 2, "coral"],
    [5, 0, "lilac"],
    [7, 0, "pink"],
    [8, 0, "orange"],
    [8, 1, "blue"],
    [10, 0, "green"],
    [12, 0, "yellow"],
    [12, 1, "lilac"],
  ];
  return (
    <svg viewBox="0 0 560 190" className="auth-layout-sketch" aria-hidden>
      {Array.from({ length: 14 }, (_, day) => (
        <g key={day}>
          <line
            x1={day * 40 + 2}
            x2={day * 40 + 2}
            y1="0"
            y2="190"
            stroke="currentColor"
            strokeOpacity="0.14"
          />
          <circle
            cx={day * 40 + 20}
            cy="18"
            r={day === 0 ? 11 : 3}
            fill={day === 0 ? "var(--marker)" : "currentColor"}
            fillOpacity={day === 0 ? 1 : 0.35}
          />
        </g>
      ))}
      {strokes.map(([day, row, color]) => (
        <path
          key={`${day}-${row}`}
          d={`M${day * 40 + 7} ${52 + row * 34}c9-2 20-2 29-1l1 15c-10 1-20 1-30 2z`}
          fill={`var(--hl-${color})`}
        />
      ))}
    </svg>
  );
}

export function AuthLayout() {
  return (
    <div className="auth-layout-layout">
      <aside className="auth-layout-aside">
        <Logo />
        <div className="auth-layout-pitch">
          <p className="auth-layout-headline">
            Entregas, notas y grupos de estudio en una sola hoja.
          </p>
          <HorizonSketch />
          <ul className="auth-layout-points">
            <li>Ve las próximas dos semanas de un vistazo.</li>
            <li>Registra tus notas y sigue tu media por asignatura.</li>
            <li>
              Prepara exámenes con tus amigos en salas con chat y archivos.
            </li>
          </ul>
        </div>
      </aside>
      <main className="auth-layout-main">
        <div className="auth-layout-mobile-brand">
          <Logo />
        </div>
        <div className="auth-layout-card">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

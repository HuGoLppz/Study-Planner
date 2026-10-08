import clsx from "clsx";
import { useLocation } from "react-router-dom";
import { useIsMobile, useMediaQuery } from "../../hooks/useUi.js";
import { NAV_GROUPS } from "../../layouts/navigation.js";
import { Skeleton, SkeletonList } from "./Feedback.jsx";
import { Logo, LogoMark } from "./Logo.jsx";

// Esqueletos con la forma real de la app: mientras carga se ve dónde va a estar cada cosa
// (rail o barras móviles, cabecera y el contenido propio de cada página), sin spinners.

const ROUTE_VARIANTS = [
  [/^\/$/, "dashboard"],
  [/^\/calendario/, "calendar"],
  [/^\/notas/, "grades"],
  [/^\/salas\/[^/]+$/, "room"],
  [/^\/(perfil|u\/)/, "profile"],
  [/^\/pomodoro/, "pomodoro"],
];

export const skeletonVariantFor = (pathname) =>
  ROUTE_VARIANTS.find(([pattern]) => pattern.test(pathname))?.[1] ?? "list";

const PAGE_WIDTH = { room: "full", profile: "medium" };

const range = (length) => Array.from({ length }, (_, index) => index);

function HeaderSkeleton({ action = true }) {
  return (
    <div className="page-header">
      <div className="page-headings">
        <Skeleton width="min(320px, 70%)" height={40} radius={10} />
        <Skeleton
          width="min(520px, 90%)"
          height={16}
          style={{ marginTop: 14 }}
        />
      </div>
      {action ? <Skeleton width={132} height={40} radius={9} /> : null}
    </div>
  );
}

// Entregas del horizonte: siempre el mismo dibujo para que no "baile" entre cargas.
const HORIZON_CHIPS = [1, 0, 2, 1, 0, 0, 1, 0, 2, 0, 1, 0, 1, 1];

function DashboardBody() {
  return (
    <>
      <Skeleton width={160} height={13} />
      <Skeleton
        width="min(640px, 92%)"
        height={44}
        radius={10}
        style={{ marginTop: 12 }}
      />
      <Skeleton width="min(380px, 70%)" height={16} style={{ marginTop: 14 }} />
      <div className="app-skeleton-horizon">
        {HORIZON_CHIPS.map((chips, day) => (
          <div key={day} className="app-skeleton-day">
            <Skeleton width={22} height={22} radius={11} />
            {range(chips).map((chip) => (
              <Skeleton key={chip} height={34} radius={6} />
            ))}
          </div>
        ))}
      </div>
      <div className="app-skeleton-columns">
        <div>
          <Skeleton width={140} height={20} />
          <SkeletonList rows={4} label="Cargando tu día" />
        </div>
        <div>
          <Skeleton width={110} height={20} />
          <div className="app-skeleton-bars">
            {[78, 62, 88, 54].map((width) => (
              <Skeleton key={width} width={`${width}%`} height={14} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function ListBody() {
  return (
    <>
      <div className="app-skeleton-toolbar">
        {[96, 92, 112, 72].map((width) => (
          <Skeleton key={width} width={width} height={36} radius={9} />
        ))}
      </div>
      <div className="app-skeleton-toolbar">
        <Skeleton width="min(340px, 100%)" height={40} radius={9} />
        <Skeleton
          width={150}
          height={40}
          radius={9}
          className="app-skeleton-desktop"
        />
        <Skeleton
          width={130}
          height={40}
          radius={9}
          className="app-skeleton-desktop"
        />
      </div>
      <SkeletonList rows={6} label="Cargando" />
    </>
  );
}

function CalendarBody({ toolbar = true }) {
  return (
    <>
      {toolbar ? (
        <div className="app-skeleton-toolbar app-skeleton-spread">
          <Skeleton width={220} height={36} radius={9} />
          <Skeleton width={200} height={36} radius={9} />
        </div>
      ) : null}
      <div
        className="app-skeleton-calendar"
        role="status"
        aria-label="Cargando el calendario"
      >
        {range(35).map((cell) => (
          <div key={cell} className="app-skeleton-cell">
            <Skeleton width={18} height={12} />
            {cell % 4 === 1 ? <Skeleton height={18} radius={5} /> : null}
          </div>
        ))}
      </div>
    </>
  );
}

function GradesBody() {
  return (
    <>
      <div className="app-skeleton-figures">
        {range(3).map((figure) => (
          <div key={figure}>
            <Skeleton width={90} height={48} radius={10} />
            <Skeleton width={120} height={13} style={{ marginTop: 10 }} />
          </div>
        ))}
      </div>
      <Skeleton
        height={260}
        radius={12}
        style={{ marginTop: "var(--space-6)" }}
      />
      <div
        className="app-skeleton-bars"
        style={{ marginTop: "var(--space-6)" }}
      >
        {[82, 64, 90, 48, 70].map((width) => (
          <div key={width} className="app-skeleton-bar-row">
            <Skeleton width={110} height={14} />
            <Skeleton width={`${width}%`} height={14} />
          </div>
        ))}
      </div>
    </>
  );
}

const BUBBLES = [
  ["55%", false],
  ["38%", true],
  ["62%", false],
  ["30%", true],
  ["48%", false],
];

function RoomBody() {
  return (
    <>
      <Skeleton width={70} height={14} />
      <div
        className="app-skeleton-toolbar app-skeleton-spread"
        style={{ marginTop: "var(--space-4)" }}
      >
        <Skeleton width="min(380px, 70%)" height={34} radius={10} />
        <Skeleton width={110} height={32} radius={16} />
      </div>
      <div className="app-skeleton-room">
        <div className="app-skeleton-chat">
          {BUBBLES.map(([width, mine], index) => (
            <Skeleton
              key={index}
              width={width}
              height={40}
              radius={14}
              style={mine ? { marginLeft: "auto" } : undefined}
            />
          ))}
          <Skeleton height={48} radius={14} style={{ marginTop: "auto" }} />
        </div>
        <div className="app-skeleton-side">
          <Skeleton height={38} radius={9} />
          <SkeletonList rows={4} label="Abriendo la sala" />
        </div>
      </div>
    </>
  );
}

function ProfileBody() {
  return (
    <>
      <div className="app-skeleton-identity">
        <Skeleton width={112} height={112} radius={56} />
        <div className="app-skeleton-lines">
          <Skeleton width="60%" height={36} radius={10} />
          <Skeleton width="35%" height={15} />
          <Skeleton width="80%" height={15} />
        </div>
      </div>
      <Skeleton
        width={180}
        height={22}
        style={{ marginTop: "var(--space-7)" }}
      />
      <Skeleton
        height={180}
        radius={12}
        style={{ marginTop: "var(--space-3)" }}
      />
    </>
  );
}

// Secciones de la página Pomodoro: se usan en el esqueleto de la página y en cada sección
// mientras llegan sus datos.
export function PomodoroSessionsSkeleton() {
  return (
    <div role="status" aria-label="Cargando las sesiones de hoy">
      <Skeleton width="75%" height={14} />
      <ol className="pomodoro-sessions">
        {[55, 40, 62].map((width) => (
          <li key={width} className="pomodoro-session">
            <Skeleton width={86} height={13} />
            <Skeleton width={`${width}%`} height={13} />
            <Skeleton width={44} height={11} />
          </li>
        ))}
      </ol>
    </div>
  );
}

const WEEK_HEIGHTS = [38, 0, 62, 80, 24, 48, 30];

export function PomodoroWeekSkeleton() {
  return (
    <div role="status" aria-label="Cargando los últimos 7 días">
      <div className="app-skeleton-week">
        {WEEK_HEIGHTS.map((height, index) => (
          <Skeleton key={index} height={`${Math.max(height, 4)}%`} radius={4} />
        ))}
      </div>
      <div className="app-skeleton-week-axis">
        {range(7).map((day) => (
          <Skeleton key={day} width={18} height={10} />
        ))}
      </div>
    </div>
  );
}

export function PomodoroSettingsSkeleton() {
  return (
    <div
      className="pomodoro-settings"
      role="status"
      aria-label="Cargando tus tiempos"
    >
      {range(4).map((field) => (
        <div key={field} className="app-skeleton-lines">
          <Skeleton width={110} height={13} />
          <Skeleton height={44} radius={9} />
        </div>
      ))}
      <Skeleton
        width={140}
        height={40}
        radius={9}
        className="pomodoro-settings-save"
      />
    </div>
  );
}

const asideSection = (width, content) => (
  <div>
    <Skeleton
      width={width}
      height={22}
      style={{ marginBottom: "var(--space-3)" }}
    />
    {content}
  </div>
);

function PomodoroBody() {
  return (
    <div className="pomodoro-layout">
      <div className="pomodoro-timer">
        <div className="pomodoro-phase-row">
          <Skeleton width={150} height={28} radius={8} />
          <Skeleton width={100} height={14} />
        </div>
        <Skeleton height={null} radius={14} className="app-skeleton-clock" />
        <Skeleton height={6} radius={3} />
        <div className="pomodoro-controls">
          <Skeleton
            width={null}
            height={48}
            radius={9}
            className="app-skeleton-control pomodoro-main-control"
          />
          {range(3).map((control) => (
            <Skeleton
              key={control}
              width={null}
              height={48}
              radius={9}
              className="app-skeleton-control"
            />
          ))}
        </div>
        <div className="pomodoro-cycle">
          <ol className="pomodoro-cycle-marks">
            {range(4).map((mark) => (
              <li key={mark} className="pomodoro-cycle-mark" />
            ))}
          </ol>
          <Skeleton width={260} height={13} />
        </div>
        <div className="app-skeleton-lines pomodoro-subject">
          <Skeleton width={120} height={13} />
          <Skeleton height={44} radius={9} />
        </div>
      </div>
      <div className="pomodoro-aside">
        <div className="pomodoro-wall-clock">
          <Skeleton width={180} height={48} radius={10} />
          <Skeleton width={160} height={14} style={{ marginTop: 8 }} />
        </div>
        {asideSection(60, <PomodoroSessionsSkeleton />)}
        {asideSection(130, <PomodoroWeekSkeleton />)}
        {asideSection(80, <PomodoroSettingsSkeleton />)}
      </div>
    </div>
  );
}

const BODIES = {
  dashboard: DashboardBody,
  list: ListBody,
  calendar: CalendarBody,
  grades: GradesBody,
  room: RoomBody,
  profile: ProfileBody,
  pomodoro: PomodoroBody,
};

// Contenido de una página en carga. `header` añade la cabecera genérica (título, entradilla y
// botón); el dashboard, la sala y el perfil dibujan la suya.
export function SkeletonBody({ variant = "list", header = false, ...props }) {
  const Body = BODIES[variant] ?? ListBody;
  const ownHeader = ["dashboard", "room", "profile"].includes(variant);
  return (
    <div className="app-skeleton" aria-busy="true">
      {header && !ownHeader ? (
        <HeaderSkeleton action={variant !== "pomodoro"} />
      ) : null}
      <Body {...props} />
    </div>
  );
}

// Página completa en carga, con el mismo ancho que la página real.
export function PageSkeleton({ variant = "list" }) {
  return (
    <div className={clsx("page", `page-${PAGE_WIDTH[variant] ?? "wide"}`)}>
      <SkeletonBody variant={variant} header />
    </div>
  );
}

function RailSkeleton() {
  const compact = useMediaQuery("(max-width: 1099px)");
  return (
    <div className="rail" aria-hidden>
      <span className="rail-brand">
        <Logo compact={compact} />
      </span>
      <div className="rail-groups">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <Skeleton
              width={78}
              height={11}
              className="app-skeleton-rail-label"
            />
            {group.items.map((item, index) => (
              <div key={item.to} className="rail-link app-skeleton-rail-link">
                <Skeleton width={22} height={22} radius={6} />
                <Skeleton
                  width={56 + ((index * 23) % 40)}
                  height={14}
                  className="rail-link-label"
                />
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="rail-footer">
        <div className="rail-profile app-skeleton-rail-link">
          <Skeleton width={32} height={32} radius={16} />
          <span className="rail-profile-text">
            <Skeleton width={110} height={13} />
            <Skeleton width={76} height={11} style={{ marginTop: 6 }} />
          </span>
        </div>
      </div>
    </div>
  );
}

function MobileBarsSkeleton({ position }) {
  if (position === "top") {
    return (
      <div className="mobile-top-bar" aria-hidden>
        <span className="mobile-brand">
          <LogoMark size={30} />
          <span className="mobile-brand-word">Study Planner</span>
        </span>
        <div className="mobile-top-actions">
          <Skeleton width={28} height={28} radius={8} style={{ margin: 8 }} />
          <Skeleton width={32} height={32} radius={16} style={{ margin: 6 }} />
        </div>
      </div>
    );
  }
  return (
    <div className="mobile-bottom-bar" aria-hidden>
      {range(5).map((tab) => (
        <div key={tab} className="mobile-tab">
          <Skeleton width={26} height={26} radius={7} />
          <Skeleton width={34} height={8} style={{ marginTop: 4 }} />
        </div>
      ))}
    </div>
  );
}

// Toda la app en carga (mientras se comprueba la sesión): marca, navegación y la página pedida.
export function AppSkeleton({ label = "Cargando Study Planner" }) {
  const isMobile = useIsMobile();
  const variant = skeletonVariantFor(useLocation().pathname);
  // Como en AppLayout: en móvil la sala ocupa toda la pantalla, sin barras.
  const bars = isMobile && variant !== "room";
  return (
    <div
      className="app-layout-app"
      role="status"
      aria-label={label}
      data-immersive={(isMobile && !bars) || undefined}
    >
      {!isMobile ? (
        <RailSkeleton />
      ) : bars ? (
        <MobileBarsSkeleton position="top" />
      ) : null}
      <div className="app-layout-sheet">
        <PageSkeleton variant={variant} />
      </div>
      {bars ? <MobileBarsSkeleton position="bottom" /> : null}
    </div>
  );
}

// Pantallas de entrada y registro mientras se comprueba si ya hay sesión.
export function AuthSkeleton() {
  return (
    <div
      className="auth-layout-layout"
      role="status"
      aria-label="Cargando Study Planner"
    >
      <aside className="auth-layout-aside">
        <Logo />
        <div className="auth-layout-pitch">
          <Skeleton width="80%" height={40} radius={10} />
          <Skeleton
            width="55%"
            height={40}
            radius={10}
            style={{ marginTop: 10 }}
          />
          <Skeleton
            height={190}
            radius={12}
            style={{ marginTop: "var(--space-6)" }}
          />
        </div>
      </aside>
      <main className="auth-layout-main">
        <div className="auth-layout-mobile-brand">
          <Logo />
        </div>
        <div className="auth-layout-card">
          <div className="app-skeleton-lines">
            <Skeleton width="70%" height={32} radius={10} />
            <Skeleton width="85%" height={14} />
            {range(2).map((field) => (
              <div
                key={field}
                className="app-skeleton-lines"
                style={{ marginTop: "var(--space-3)" }}
              >
                <Skeleton width={120} height={13} />
                <Skeleton height={44} radius={9} />
              </div>
            ))}
            <Skeleton
              height={44}
              radius={9}
              style={{ marginTop: "var(--space-3)" }}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

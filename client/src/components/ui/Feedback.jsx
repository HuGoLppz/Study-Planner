import { ArrowClockwise, WarningCircle } from "@phosphor-icons/react";
import clsx from "clsx";
import { Button } from "./Button.jsx";

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 6,
  className,
  style,
}) {
  return (
    <span
      className={clsx("feedback-skeleton", className)}
      style={{ width, height, borderRadius: radius, ...style }}
      aria-hidden
    />
  );
}

// Filas de esqueleto con la misma estructura que una lista de tareas.
export function SkeletonList({ rows = 4, label = "Cargando" }) {
  return (
    <div className="feedback-skeleton-list" role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="feedback-skeleton-row">
          <Skeleton width={22} height={22} radius={11} />
          <div className="feedback-skeleton-lines">
            <Skeleton width={`${70 - index * 9}%`} height={14} />
            <Skeleton width={`${38 + index * 6}%`} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Estado vacío: un icono con relleno fluorescente, una frase clara y una acción.
export function EmptyState({
  icon: Icon,
  title,
  children,
  action,
  compact = false,
}) {
  return (
    <div
      className={clsx("feedback-empty", compact && "feedback-empty-compact")}
    >
      {Icon ? (
        <span className="feedback-empty-icon" aria-hidden>
          <Icon size={compact ? 32 : 44} weight="duotone" />
        </span>
      ) : null}
      <p className="feedback-empty-title">{title}</p>
      {children ? <p className="feedback-empty-text">{children}</p> : null}
      {action ? <div className="feedback-empty-action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "No se ha podido cargar",
  error,
  onRetry,
  compact = false,
}) {
  return (
    <div
      className={clsx(
        "feedback-empty",
        "feedback-error",
        compact && "feedback-empty-compact",
      )}
      role="alert"
    >
      <span className="feedback-error-icon" aria-hidden>
        <WarningCircle size={compact ? 28 : 36} weight="duotone" />
      </span>
      <p className="feedback-empty-title">{title}</p>
      {error?.message ? (
        <p className="feedback-empty-text">{error.message}</p>
      ) : null}
      {onRetry ? (
        <div className="feedback-empty-action">
          <Button
            variant="secondary"
            size="sm"
            icon={ArrowClockwise}
            onClick={() => onRetry()}
          >
            Reintentar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

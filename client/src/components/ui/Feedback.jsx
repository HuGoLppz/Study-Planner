import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react';
import clsx from 'clsx';
import { Button } from './Button.jsx';
import styles from './Feedback.module.css';
import { Spinner } from './Spinner.jsx';

export function Skeleton({ width = '100%', height = 16, radius = 6, className, style }) {
  return <span className={clsx(styles.skeleton, className)} style={{ width, height, borderRadius: radius, ...style }} aria-hidden />;
}

// Filas de esqueleto con la misma estructura que una lista de tareas.
export function SkeletonList({ rows = 4, label = 'Cargando' }) {
  return (
    <div className={styles.skeletonList} role="status" aria-label={label}>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className={styles.skeletonRow}>
          <Skeleton width={22} height={22} radius={11} />
          <div className={styles.skeletonLines}>
            <Skeleton width={`${70 - index * 9}%`} height={14} />
            <Skeleton width={`${38 + index * 6}%`} height={11} />
          </div>
        </div>
      ))}
    </div>
  );
}

// Estado vacío: un icono con relleno fluorescente, una frase clara y una acción.
export function EmptyState({ icon: Icon, title, children, action, compact = false }) {
  return (
    <div className={clsx(styles.empty, compact && styles.emptyCompact)}>
      {Icon ? (
        <span className={styles.emptyIcon} aria-hidden>
          <Icon size={compact ? 32 : 44} weight="duotone" />
        </span>
      ) : null}
      <p className={styles.emptyTitle}>{title}</p>
      {children ? <p className={styles.emptyText}>{children}</p> : null}
      {action ? <div className={styles.emptyAction}>{action}</div> : null}
    </div>
  );
}

export function ErrorState({ title = 'No se ha podido cargar', error, onRetry, compact = false }) {
  return (
    <div className={clsx(styles.empty, styles.error, compact && styles.emptyCompact)} role="alert">
      <span className={styles.errorIcon} aria-hidden>
        <WarningCircle size={compact ? 28 : 36} weight="duotone" />
      </span>
      <p className={styles.emptyTitle}>{title}</p>
      {error?.message ? <p className={styles.emptyText}>{error.message}</p> : null}
      {onRetry ? (
        <div className={styles.emptyAction}>
          <Button variant="secondary" size="sm" icon={ArrowClockwise} onClick={() => onRetry()}>
            Reintentar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

export function PageLoader({ label = 'Cargando' }) {
  return (
    <div className={styles.pageLoader}>
      <Spinner size={28} label={label} />
    </div>
  );
}

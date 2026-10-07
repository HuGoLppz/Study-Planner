import clsx from 'clsx';
import styles from './Logo.module.css';

// Marca: una hoja de tinta con un trazo de fluorescente.
export function LogoMark({ size = 32 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden className={styles.mark}>
      <rect width="64" height="64" rx="15" fill="var(--logo-sheet, #1B2463)" />
      <path d="M10 38c12-3 30-3 44-4l1 9c-15 1-31 1-45 4z" fill="#F7E641" />
      <path d="M19 22h26M19 30h20" stroke="var(--logo-lines, #fff)" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ compact = false, className }) {
  return (
    <span className={clsx(styles.logo, className)}>
      <LogoMark />
      {compact ? <span className="visually-hidden">Study Planner</span> : <span className={styles.word}>Study Planner</span>}
    </span>
  );
}

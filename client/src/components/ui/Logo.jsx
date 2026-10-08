import clsx from "clsx";

export function LogoMark({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden
      className="logo-mark"
    >
      <rect width="64" height="64" rx="15" fill="var(--logo-sheet, #141416)" />
      <path d="M10 38c12-3 30-3 44-4l1 9c-15 1-31 1-45 4z" fill="#F7E641" />
      <path
        d="M19 22h26M19 30h20"
        stroke="var(--logo-lines, #fff)"
        strokeWidth="5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Logo({ compact = false, className }) {
  return (
    <span className={clsx("logo", className)}>
      <LogoMark />
      {compact ? (
        <span className="visually-hidden">Study Planner</span>
      ) : (
        <span className="logo-word">Study Planner</span>
      )}
    </span>
  );
}

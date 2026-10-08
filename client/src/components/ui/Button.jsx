import clsx from "clsx";
import { forwardRef } from "react";
import { Spinner } from "./Spinner.jsx";

const ICON_SIZE = { sm: 16, md: 18, lg: 20 };

// Clase de app.css de cada variante (en el CSS van en kebab-case).
const VARIANT_CLASS = {
  primary: "button-primary",
  secondary: "button-secondary",
  ghost: "button-ghost",
  danger: "button-danger",
  dangerGhost: "button-danger-ghost",
};

export const Button = forwardRef(function Button(
  {
    as: Component = "button",
    variant = "primary",
    size = "md",
    icon: Icon,
    loading = false,
    block = false,
    disabled = false,
    type = "button",
    className,
    children,
    ...props
  },
  ref,
) {
  const isButton = Component === "button";
  return (
    <Component
      ref={ref}
      className={clsx(
        "button",
        VARIANT_CLASS[variant],
        `button-${size}`,
        block && "button-block",
        className,
      )}
      {...(isButton ? { type, disabled: disabled || loading } : {})}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <Spinner size={ICON_SIZE[size]} />
      ) : Icon ? (
        <Icon size={ICON_SIZE[size]} weight="bold" aria-hidden />
      ) : null}
      {children != null && <span>{children}</span>}
    </Component>
  );
});

export const IconButton = forwardRef(function IconButton(
  {
    icon: Icon,
    label,
    variant = "ghost",
    size = "md",
    className,
    badge,
    weight = "regular",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      className={clsx(
        "button-icon-button",
        VARIANT_CLASS[variant],
        `button-icon-${size}`,
        className,
      )}
      {...props}
    >
      <Icon size={size === "sm" ? 18 : 22} weight={weight} aria-hidden />
      {badge ? <span className="button-badge">{badge}</span> : null}
    </button>
  );
});

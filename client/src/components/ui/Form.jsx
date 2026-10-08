import { CaretDown } from "@phosphor-icons/react";
import clsx from "clsx";
import { cloneElement, forwardRef, isValidElement, useId } from "react";

// Etiqueta + control + ayuda + error, con los atributos ARIA conectados.
export function Field({
  label,
  hint,
  error,
  children,
  className,
  optional = false,
  hideLabel = false,
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby":
          [hintId, errorId].filter(Boolean).join(" ") || undefined,
      })
    : children;

  return (
    <div className={clsx("form-field", className)}>
      {label ? (
        <label
          htmlFor={children?.props?.id ?? id}
          className={clsx("form-label", hideLabel && "visually-hidden")}
        >
          {label}
          {optional ? <span className="form-optional">opcional</span> : null}
        </label>
      ) : null}
      {control}
      {hint && !error ? (
        <p id={hintId} className="form-hint">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input(
  { className, icon: Icon, ...props },
  ref,
) {
  if (!Icon)
    return (
      <input ref={ref} className={clsx("form-control", className)} {...props} />
    );
  return (
    <div className="form-with-icon">
      <Icon size={18} className="form-leading-icon" aria-hidden />
      <input ref={ref} className={clsx("form-control", className)} {...props} />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea(
  { className, rows = 4, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={clsx("form-control", "form-textarea", className)}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <div className="form-select-wrap">
      <select
        ref={ref}
        className={clsx("form-control", "form-select", className)}
        {...props}
      >
        {children}
      </select>
      <CaretDown size={16} className="form-caret" aria-hidden />
    </div>
  );
});

export function FormRow({ children, className }) {
  return <div className={clsx("form-row", className)}>{children}</div>;
}

export function FormActions({ children, className }) {
  return <div className={clsx("form-actions", className)}>{children}</div>;
}

export function Switch({
  checked,
  onChange,
  label,
  description,
  disabled = false,
}) {
  const id = useId();
  return (
    <div className="form-switch-row">
      <div>
        <label htmlFor={id} className="form-switch-label">
          {label}
        </label>
        {description ? <p className="form-hint">{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className="form-switch"
        onClick={() => onChange(!checked)}
      >
        <span className="form-thumb" />
      </button>
    </div>
  );
}

// Grupo de opciones excluyentes con aspecto de botones (radio accesible).
export function ChoiceGroup({ value, onChange, options, label, name }) {
  return (
    <div role="radiogroup" aria-label={label} className="form-choices">
      {options.map((option) => (
        <label
          key={option.value}
          className={clsx(
            "form-choice",
            value === option.value && "form-choice-active",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="visually-hidden"
          />
          {option.icon ? (
            <option.icon
              size={16}
              weight={value === option.value ? "fill" : "regular"}
              aria-hidden
            />
          ) : null}
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

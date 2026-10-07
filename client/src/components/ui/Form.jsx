import { CaretDown } from '@phosphor-icons/react';
import clsx from 'clsx';
import { cloneElement, forwardRef, isValidElement, useId } from 'react';
import styles from './Form.module.css';

// Etiqueta + control + ayuda + error, con los atributos ARIA conectados.
export function Field({ label, hint, error, children, className, optional = false, hideLabel = false }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id ?? id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })
    : children;

  return (
    <div className={clsx(styles.field, className)}>
      {label ? (
        <label htmlFor={children?.props?.id ?? id} className={clsx(styles.label, hideLabel && 'visually-hidden')}>
          {label}
          {optional ? <span className={styles.optional}>opcional</span> : null}
        </label>
      ) : null}
      {control}
      {hint && !error ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, icon: Icon, ...props }, ref) {
  if (!Icon) return <input ref={ref} className={clsx(styles.control, className)} {...props} />;
  return (
    <div className={styles.withIcon}>
      <Icon size={18} className={styles.leadingIcon} aria-hidden />
      <input ref={ref} className={clsx(styles.control, className)} {...props} />
    </div>
  );
});

export const Textarea = forwardRef(function Textarea({ className, rows = 4, ...props }, ref) {
  return <textarea ref={ref} rows={rows} className={clsx(styles.control, styles.textarea, className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, children, ...props }, ref) {
  return (
    <div className={styles.selectWrap}>
      <select ref={ref} className={clsx(styles.control, styles.select, className)} {...props}>
        {children}
      </select>
      <CaretDown size={16} className={styles.caret} aria-hidden />
    </div>
  );
});

export function FormRow({ children, className }) {
  return <div className={clsx(styles.row, className)}>{children}</div>;
}

export function FormActions({ children, className }) {
  return <div className={clsx(styles.actions, className)}>{children}</div>;
}

export function Switch({ checked, onChange, label, description, disabled = false }) {
  const id = useId();
  return (
    <div className={styles.switchRow}>
      <div>
        <label htmlFor={id} className={styles.switchLabel}>
          {label}
        </label>
        {description ? <p className={styles.hint}>{description}</p> : null}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        className={styles.switch}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.thumb} />
      </button>
    </div>
  );
}

// Grupo de opciones excluyentes con aspecto de botones (radio accesible).
export function ChoiceGroup({ value, onChange, options, label, name }) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.choices}>
      {options.map((option) => (
        <label key={option.value} className={clsx(styles.choice, value === option.value && styles.choiceActive)}>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="visually-hidden"
          />
          {option.icon ? <option.icon size={16} weight={value === option.value ? 'fill' : 'regular'} aria-hidden /> : null}
          <span>{option.label}</span>
        </label>
      ))}
    </div>
  );
}

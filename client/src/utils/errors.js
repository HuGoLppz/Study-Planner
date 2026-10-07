export const getErrorMessage = (error, fallback = 'Algo ha fallado. Inténtalo de nuevo.') =>
  error?.message || fallback;

// Lleva los errores de campo del servidor (422/409) a react-hook-form.
// Devuelve true si alguno se ha asignado a un campo del formulario.
export function applyFieldErrors(setError, error, fieldMap = {}) {
  const fields = error?.fields;
  if (!fields || typeof fields !== 'object') return false;

  let applied = false;
  for (const [field, message] of Object.entries(fields)) {
    if (typeof message !== 'string') continue;
    setError(fieldMap[field] ?? field, { type: 'server', message });
    applied = true;
  }
  return applied;
}

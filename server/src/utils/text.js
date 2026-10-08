// Normaliza texto para búsquedas: minúsculas y sin tildes.
export function normalizeText(value = "") {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

// "Hugo López Sanz" → ['hugo', 'lopez', 'sanz']
export function tokenize(value = "") {
  const tokens = normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set(tokens)];
}

export function round(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

// Escapa los comodines de LIKE (se usa con ESCAPE '\').
export function escapeLike(value = "") {
  return value.replace(/[\%_]/g, "\$&");
}

// Texto que se guarda para buscar por nombre: "Hugo López" → "hugo lopez".
export const searchableName = (name) => tokenize(name).join(" ");

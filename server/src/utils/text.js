// Normaliza texto para búsquedas: minúsculas y sin tildes.
export function normalizeText(value = '') {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

// "Hugo López Sanz" → ['hugo', 'lopez', 'sanz']
export function tokenize(value = '') {
  const tokens = normalizeText(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
  return [...new Set(tokens)];
}

export function escapeRegex(value = '') {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function round(value, decimals = 2) {
  if (value === null || value === undefined || Number.isNaN(value)) return null;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

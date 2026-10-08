const gradeFormat = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const oneDecimal = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const percent = new Intl.NumberFormat("es-ES", {
  style: "percent",
  maximumFractionDigits: 0,
});

export const formatGrade = (value) =>
  value == null ? "—" : gradeFormat.format(value);
export const formatAverage = (value) =>
  value == null ? "—" : oneDecimal.format(value);
export const formatPercent = (value) => percent.format(value ?? 0);

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function formatMinutes(seconds) {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export const plural = (count, one, many) =>
  `${count} ${count === 1 ? one : many}`;

// Nota cualitativa usada en el sistema universitario español.
export function gradeBand(score) {
  if (score == null) return null;
  if (score < 5) return "Suspenso";
  if (score < 7) return "Aprobado";
  if (score < 9) return "Notable";
  return "Sobresaliente";
}

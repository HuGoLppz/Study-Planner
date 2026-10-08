export const SUBJECT_COLORS = [
  { value: "yellow", label: "Amarillo" },
  { value: "pink", label: "Rosa" },
  { value: "green", label: "Verde" },
  { value: "orange", label: "Naranja" },
  { value: "blue", label: "Azul" },
  { value: "lilac", label: "Lila" },
  { value: "mint", label: "Menta" },
  { value: "coral", label: "Coral" },
];

export const subjectColor = (color) => `var(--hl-${color ?? "yellow"})`;

// Primer color que el usuario aún no usa, para proponerlo al crear una asignatura.
export function nextFreeColor(subjects = []) {
  const used = new Set(subjects.map((subject) => subject.color));
  return (
    SUBJECT_COLORS.find((color) => !used.has(color.value)) ??
    SUBJECT_COLORS[subjects.length % 8]
  ).value;
}

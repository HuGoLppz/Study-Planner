import clsx from "clsx";
import { subjectColor } from "../../utils/subjects.js";

// La asignatura se muestra como un subrayado con su fluorescente.
export function SubjectTag({
  subject,
  size = "md",
  className,
  fallback = "Sin asignatura",
}) {
  if (!subject) {
    return fallback ? (
      <span
        className={clsx("subject-tag-none", `subject-tag-${size}`, className)}
      >
        {fallback}
      </span>
    ) : null;
  }
  return (
    <span
      className={clsx(
        "swipe",
        "subject-tag-tag",
        `subject-tag-${size}`,
        className,
      )}
      style={{ "--swipe": subjectColor(subject.color) }}
      title={subject.name}
    >
      {subject.name}
    </span>
  );
}

export function SubjectDot({ color, size = 10 }) {
  return (
    <span
      className="subject-tag-dot"
      style={{ width: size, height: size, background: subjectColor(color) }}
      aria-hidden
    />
  );
}

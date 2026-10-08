import { useEffect, useRef, useState } from "react";
import { useRemoveGrade, useSetGrade } from "../../hooks/useGrades.js";
import { formatGrade, gradeBand } from "../../utils/format.js";
import { Button } from "../ui/Button.jsx";
import { Field, Input } from "../ui/Form.jsx";

const parseScore = (value) => {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const score = Number(normalized);
  return Number.isFinite(score) ? score : NaN;
};

// Nota de 0 a 10. Acepta coma o punto decimal.
export function GradeForm({ task, autoFocus = false }) {
  const setGrade = useSetGrade();
  const removeGrade = useRemoveGrade();
  const current = task.grade?.score ?? null;
  const [value, setValue] = useState(
    current == null ? "" : formatGrade(current),
  );
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    setValue(current == null ? "" : formatGrade(current));
  }, [current]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  const submit = (event) => {
    event.preventDefault();
    const score = parseScore(value);
    if (score == null || Number.isNaN(score) || score < 0 || score > 10) {
      setError("Escribe una nota entre 0 y 10");
      return;
    }
    setError(null);
    setGrade.mutate({ taskId: task._id, score: Math.round(score * 100) / 100 });
  };

  const preview = parseScore(value);
  const band =
    preview != null && preview >= 0 && preview <= 10
      ? gradeBand(preview)
      : null;

  return (
    <form className="task-detail-grade-form" onSubmit={submit} noValidate>
      <Field
        label="Nota"
        error={error}
        hint={band ? band : "De 0 a 10, admite decimales"}
      >
        <Input
          ref={inputRef}
          inputMode="decimal"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="7,5"
          className="task-detail-grade-input"
          autoComplete="off"
        />
      </Field>
      <div className="task-detail-grade-actions">
        <Button type="submit" loading={setGrade.isPending}>
          {current == null ? "Guardar nota" : "Actualizar nota"}
        </Button>
        {current != null ? (
          <Button
            variant="ghost"
            onClick={() => removeGrade.mutate(task._id)}
            loading={removeGrade.isPending}
          >
            Quitar nota
          </Button>
        ) : null}
      </div>
    </form>
  );
}

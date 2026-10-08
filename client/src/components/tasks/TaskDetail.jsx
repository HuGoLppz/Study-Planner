import {
  ArrowCounterClockwise,
  Check,
  PencilSimple,
  Trash,
} from "@phosphor-icons/react";
import clsx from "clsx";
import { useSubjects } from "../../hooks/useSubjects.js";
import {
  useCompleteTask,
  useDeleteTask,
  useReopenTask,
} from "../../hooks/useTasks.js";
import { useNow } from "../../hooks/useUi.js";
import { confirm } from "../../store/confirmStore.js";
import {
  formatDateTime,
  formatLongDate,
  formatRelativeDue,
} from "../../utils/dates.js";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  isCompleted,
  isOverdue,
} from "../../utils/tasks.js";
import { Button } from "../ui/Button.jsx";
import { SubjectTag } from "../ui/SubjectTag.jsx";
import { GradeForm } from "./GradeForm.jsx";
import { PriorityMark, TaskType } from "./TaskBits.jsx";

export function TaskDetail({ task, onEdit, onDeleted, focusGrade = false }) {
  const now = useNow();
  const { get } = useSubjects();
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const remove = useDeleteTask();
  const done = isCompleted(task);
  const overdue = isOverdue(task, now);

  const handleDelete = async () => {
    const ok = await confirm({
      title: "¿Eliminar esta tarea?",
      description: `«${task.title}» y su nota se borrarán definitivamente.`,
      confirmLabel: "Eliminar tarea",
      tone: "danger",
    });
    if (!ok) return;
    await remove.mutateAsync(task._id);
    onDeleted?.();
  };

  return (
    <div className="task-detail-detail">
      <div className="task-detail-status">
        <span
          className={clsx(
            "task-detail-status-chip",
            done && "task-detail-status-done",
            overdue && "task-detail-status-overdue",
          )}
        >
          {overdue ? "Atrasada" : STATUS_LABEL[task.status]}
        </span>
        <SubjectTag subject={get(task.subject)} />
      </div>

      <dl className="task-detail-facts">
        <div>
          <dt>Entrega</dt>
          <dd>
            {formatDateTime(task.dueDate)}
            {!done ? (
              <span
                className={clsx(
                  "task-detail-relative",
                  overdue && "overdue-text",
                )}
              >
                {" "}
                ({formatRelativeDue(task.dueDate, now)})
              </span>
            ) : null}
          </dd>
        </div>
        <div>
          <dt>Tipo</dt>
          <dd>
            <TaskType type={task.type} />
          </dd>
        </div>
        <div>
          <dt>Urgencia</dt>
          <dd className="task-detail-inline">
            <PriorityMark priority={task.priority} />{" "}
            {PRIORITY_LABEL[task.priority]}
          </dd>
        </div>
        <div>
          <dt>Creada</dt>
          <dd>{formatLongDate(task.createdAt)}</dd>
        </div>
        {done && task.completedAt ? (
          <div>
            <dt>Completada</dt>
            <dd>{formatLongDate(task.completedAt)}</dd>
          </div>
        ) : null}
      </dl>

      {task.description ? (
        <p className="task-detail-description">{task.description}</p>
      ) : null}

      <section className="task-detail-grade-section" aria-label="Calificación">
        {done ? (
          <GradeForm task={task} autoFocus={focusGrade} />
        ) : (
          <p className="task-detail-grade-hint">
            Cuando completes la tarea podrás registrar su nota.
          </p>
        )}
      </section>

      <div className="task-detail-actions">
        {done ? (
          <Button
            variant="secondary"
            icon={ArrowCounterClockwise}
            onClick={() => reopen.mutate(task._id)}
            loading={reopen.isPending}
          >
            Reabrir
          </Button>
        ) : (
          <Button
            icon={Check}
            onClick={() => complete.mutate({ id: task._id })}
            loading={complete.isPending}
          >
            Completar
          </Button>
        )}
        <Button variant="secondary" icon={PencilSimple} onClick={onEdit}>
          Editar
        </Button>
        <Button
          variant="dangerGhost"
          icon={Trash}
          onClick={handleDelete}
          loading={remove.isPending}
          className="task-detail-delete"
        >
          Eliminar
        </Button>
      </div>
    </div>
  );
}

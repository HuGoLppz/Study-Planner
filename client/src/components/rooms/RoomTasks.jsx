import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ListChecks, Plus, Trash } from "@phosphor-icons/react";
import clsx from "clsx";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  useCreateRoomTask,
  useDeleteRoomTask,
  useUpdateRoomTask,
} from "../../hooks/useRooms.js";
import { useNow } from "../../hooks/useUi.js";
import { confirm } from "../../store/confirmStore.js";
import {
  combineDateTime,
  formatDueShort,
  toDateInput,
  toTimeInput,
} from "../../utils/dates.js";
import { applyFieldErrors } from "../../utils/errors.js";
import { STATUSES } from "../../utils/tasks.js";
import { Avatar } from "../ui/Avatar.jsx";
import { Button } from "../ui/Button.jsx";
import { EmptyState } from "../ui/Feedback.jsx";
import { Field, FormRow, Input, Select, Textarea } from "../ui/Form.jsx";
import { Modal, OverlayFooter } from "../ui/Overlay.jsx";
import { Segmented } from "../ui/Tabs.jsx";

const schema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Ponle un título")
    .max(120, "Como máximo 120 caracteres"),
  description: z.string().trim().max(1000, "Como máximo 1000 caracteres"),
  assigneeId: z.string(),
  status: z.enum(STATUSES.map((status) => status.value)),
  date: z.string(),
  time: z.string(),
});

function RoomTaskForm({
  room,
  task,
  members,
  currentUserId,
  canDelete,
  onDone,
}) {
  const create = useCreateRoomTask();
  const update = useUpdateRoomTask();
  const remove = useDeleteRoomTask();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      title: task?.title ?? "",
      description: task?.description ?? "",
      assigneeId: task ? (task.assignee ?? "") : currentUserId,
      status: task?.status ?? "pending",
      date: toDateInput(task?.dueDate),
      time: toTimeInput(task?.dueDate),
    },
  });

  const onSubmit = handleSubmit(
    async ({ date, time, assigneeId, ...values }) => {
      const data = {
        ...values,
        assigneeId: assigneeId || null,
        dueDate: date ? combineDateTime(date, time).toISOString() : null,
      };
      try {
        if (task)
          await update.mutateAsync({ id: room._id, taskId: task._id, data });
        else await create.mutateAsync({ id: room._id, data });
        onDone();
      } catch (error) {
        applyFieldErrors(setError, error, { dueDate: "date" });
      }
    },
  );

  const handleDelete = async () => {
    const ok = await confirm({
      title: "¿Eliminar esta tarea de la sala?",
      description: `«${task.title}» desaparecerá para todos.`,
      confirmLabel: "Eliminar",
      tone: "danger",
    });
    if (!ok) return;
    await remove.mutateAsync({ id: room._id, taskId: task._id });
    onDone();
  };

  return (
    <form onSubmit={onSubmit} noValidate className="rooms-form">
      <Field label="Título" error={errors.title?.message}>
        <Input
          {...register("title")}
          placeholder="Ej. Resolver los ejercicios 1 a 5"
          autoFocus
          autoComplete="off"
        />
      </Field>
      <Field label="Responsable" error={errors.assigneeId?.message}>
        <Select {...register("assigneeId")}>
          <option value="">Sin asignar</option>
          {members.map((member) => (
            <option key={member.user._id} value={member.user._id}>
              {member.user._id === currentUserId
                ? `${member.user.name} (tú)`
                : member.user.name}
            </option>
          ))}
        </Select>
      </Field>
      <FormRow>
        <Field label="Fecha de entrega" optional error={errors.date?.message}>
          <Input type="date" {...register("date")} />
        </Field>
        <Field label="Hora" optional>
          <Input type="time" {...register("time")} />
        </Field>
      </FormRow>
      {task ? (
        <Field label="Estado">
          <Select {...register("status")}>
            {STATUSES.map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </Select>
        </Field>
      ) : null}
      <Field label="Descripción" optional error={errors.description?.message}>
        <Textarea {...register("description")} rows={3} />
      </Field>
      <OverlayFooter>
        {task && canDelete ? (
          <Button
            variant="dangerGhost"
            icon={Trash}
            onClick={handleDelete}
            loading={remove.isPending}
            className="rooms-footer-start"
          >
            Eliminar
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {task ? "Guardar cambios" : "Añadir tarea"}
        </Button>
      </OverlayFooter>
    </form>
  );
}

export function RoomTasks({ room, currentUserId, isAdmin }) {
  const now = useNow();
  const update = useUpdateRoomTask();
  const [filter, setFilter] = useState("open");
  const [editing, setEditing] = useState(null); // null | 'new' | task

  const memberMap = useMemo(
    () => new Map(room.members.map((member) => [member.user._id, member.user])),
    [room.members],
  );
  const counts = {
    open: room.tasks.filter((task) => task.status !== "completed").length,
    mine: room.tasks.filter(
      (task) => task.assignee === currentUserId && task.status !== "completed",
    ).length,
    done: room.tasks.filter((task) => task.status === "completed").length,
  };
  const visible = room.tasks
    .filter((task) =>
      filter === "open"
        ? task.status !== "completed"
        : filter === "mine"
          ? task.assignee === currentUserId
          : task.status === "completed",
    )
    .sort(
      (a, b) =>
        (a.dueDate ? new Date(a.dueDate) : Infinity) -
        (b.dueDate ? new Date(b.dueDate) : Infinity),
    );

  const toggle = (task) =>
    update.mutate({
      id: room._id,
      taskId: task._id,
      data: { status: task.status === "completed" ? "pending" : "completed" },
    });

  return (
    <div className="rooms-panel-body">
      <div className="rooms-panel-toolbar">
        <Segmented
          label="Filtrar tareas de la sala"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Abiertas", count: counts.open },
            { value: "mine", label: "Mías", count: counts.mine },
            { value: "done", label: "Hechas", count: counts.done },
          ]}
        />
        <Button size="sm" icon={Plus} onClick={() => setEditing("new")}>
          Nueva
        </Button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title={
            room.tasks.length ? "Nada en esta lista" : "Repartid el trabajo"
          }
          compact
        >
          {room.tasks.length
            ? "Cambia el filtro para ver el resto de tareas."
            : "Crea tareas y asígnalas a quien se vaya a encargar."}
        </EmptyState>
      ) : (
        <ul className="rooms-task-list">
          {visible.map((task) => {
            const assignee = task.assignee
              ? memberMap.get(task.assignee)
              : null;
            const done = task.status === "completed";
            const late = !done && task.dueDate && new Date(task.dueDate) < now;
            return (
              <li
                key={task._id}
                className={clsx("rooms-task-row", done && "rooms-task-done")}
              >
                <button
                  type="button"
                  className={clsx(
                    "rooms-task-check",
                    done && "rooms-task-check-done",
                    late && "rooms-task-check-late",
                  )}
                  onClick={() => toggle(task)}
                  aria-pressed={done}
                  aria-label={
                    done
                      ? `Reabrir «${task.title}»`
                      : `Completar «${task.title}»`
                  }
                >
                  <Check size={12} weight="bold" aria-hidden />
                </button>
                <button
                  type="button"
                  className="rooms-task-main"
                  onClick={() => setEditing(task)}
                >
                  <span className="rooms-task-title">{task.title}</span>
                  <span className="rooms-task-meta">
                    {assignee ? (
                      <>
                        <Avatar user={assignee} size="xs" />
                        {assignee._id === currentUserId ? "Tú" : assignee.name}
                      </>
                    ) : (
                      "Sin asignar"
                    )}
                    {task.dueDate ? (
                      <span className={late ? "overdue-text" : undefined}>
                        {formatDueShort(task.dueDate, now)}
                      </span>
                    ) : null}
                    {task.status === "in_progress" ? (
                      <span>En curso</span>
                    ) : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={
          editing === "new" ? "Nueva tarea de la sala" : "Tarea de la sala"
        }
      >
        {editing ? (
          <RoomTaskForm
            room={room}
            task={editing === "new" ? null : editing}
            members={room.members}
            currentUserId={currentUserId}
            canDelete={
              editing !== "new" &&
              (isAdmin || editing.createdBy === currentUserId)
            }
            onDone={() => setEditing(null)}
          />
        ) : null}
      </Modal>
    </div>
  );
}

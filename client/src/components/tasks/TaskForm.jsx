import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { useSubjects } from "../../hooks/useSubjects.js";
import { useCreateTask, useUpdateTask } from "../../hooks/useTasks.js";
import {
  combineDateTime,
  toDateInput,
  toTimeInput,
} from "../../utils/dates.js";
import { applyFieldErrors } from "../../utils/errors.js";
import { PRIORITIES, STATUSES, TASK_TYPES } from "../../utils/tasks.js";
import { Button } from "../ui/Button.jsx";
import {
  ChoiceGroup,
  Field,
  FormRow,
  Input,
  Select,
  Textarea,
} from "../ui/Form.jsx";
import { OverlayFooter } from "../ui/Overlay.jsx";

const schema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, "Ponle un título a la tarea")
      .max(120, "Como máximo 120 caracteres"),
    description: z.string().trim().max(2000, "Como máximo 2000 caracteres"),
    subjectId: z.string(),
    type: z.enum(TASK_TYPES.map((type) => type.value)),
    priority: z.enum(PRIORITIES.map((priority) => priority.value)),
    status: z.enum(STATUSES.map((status) => status.value)),
    dueDate: z.string().min(1, "Elige la fecha de entrega"),
    dueTime: z.string(),
  })
  .refine((values) => combineDateTime(values.dueDate, values.dueTime), {
    message: "Fecha no válida",
    path: ["dueDate"],
  });

function defaultsFor(task, defaults) {
  const due = task?.dueDate ?? defaults?.dueDate ?? null;
  return {
    title: task?.title ?? "",
    description: task?.description ?? "",
    subjectId: task?.subject ?? defaults?.subjectId ?? "",
    type: task?.type ?? "assignment",
    priority: task?.priority ?? "medium",
    status: task?.status ?? "pending",
    dueDate: toDateInput(due),
    dueTime: toTimeInput(due),
  };
}

export function TaskForm({ task, defaults, onDone, onCancel }) {
  const { subjects } = useSubjects();
  const create = useCreateTask();
  const update = useUpdateTask();
  const editing = Boolean(task);

  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: defaultsFor(task, defaults),
  });

  const onSubmit = handleSubmit(
    async ({ dueDate, dueTime, subjectId, ...values }) => {
      const payload = {
        ...values,
        subjectId: subjectId || null,
        dueDate: combineDateTime(dueDate, dueTime).toISOString(),
      };
      try {
        const saved = editing
          ? await update.mutateAsync({ id: task._id, data: payload })
          : await create.mutateAsync(payload);
        onDone?.(saved);
      } catch (error) {
        applyFieldErrors(setError, error);
      }
    },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="task-form-form">
      <Field label="Título" error={errors.title?.message}>
        <Input
          {...register("title")}
          placeholder="Ej. Entregar la práctica 3"
          autoFocus={!editing}
          autoComplete="off"
        />
      </Field>

      <FormRow>
        <Field label="Fecha de entrega" error={errors.dueDate?.message}>
          <Input type="date" {...register("dueDate")} />
        </Field>
        <Field
          label="Hora"
          optional
          hint="Sin hora, vence a las 23:59"
          error={errors.dueTime?.message}
        >
          <Input type="time" {...register("dueTime")} />
        </Field>
      </FormRow>

      <Field
        label="Asignatura"
        error={errors.subjectId?.message}
        hint={
          subjects.length === 0 ? (
            <>
              Aún no tienes asignaturas.{" "}
              <Link to="/asignaturas">Crea la primera</Link> para agrupar tus
              tareas.
            </>
          ) : undefined
        }
      >
        <Select {...register("subjectId")}>
          <option value="">Sin asignatura</option>
          {subjects.map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tipo de actividad">
        <Controller
          control={control}
          name="type"
          render={({ field }) => (
            <ChoiceGroup
              name="type"
              label="Tipo de actividad"
              value={field.value}
              onChange={field.onChange}
              options={TASK_TYPES}
            />
          )}
        />
      </Field>

      <FormRow>
        <Field label="Urgencia">
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <ChoiceGroup
                name="priority"
                label="Urgencia"
                value={field.value}
                onChange={field.onChange}
                options={PRIORITIES}
              />
            )}
          />
        </Field>
        {editing ? (
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
      </FormRow>

      <Field label="Descripción" optional error={errors.description?.message}>
        <Textarea
          {...register("description")}
          placeholder="Enunciado, enlaces, apuntes que necesitas…"
          rows={4}
        />
      </Field>

      <OverlayFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {editing ? "Guardar cambios" : "Crear tarea"}
        </Button>
      </OverlayFooter>
    </form>
  );
}

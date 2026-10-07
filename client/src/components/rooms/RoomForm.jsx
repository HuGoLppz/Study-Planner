import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateRoom, useUpdateRoom } from '../../hooks/useRooms.js';
import { useSubjects } from '../../hooks/useSubjects.js';
import { combineDateTime, toDateInput, toTimeInput } from '../../utils/dates.js';
import { applyFieldErrors } from '../../utils/errors.js';
import { Button } from '../ui/Button.jsx';
import { Field, FormRow, Input, Select, Textarea } from '../ui/Form.jsx';
import { OverlayFooter } from '../ui/Overlay.jsx';
import styles from './Rooms.module.css';

const KEEP = '__keep__';

const schema = z
  .object({
    name: z.string().trim().min(2, 'Ponle un nombre a la sala').max(80, 'Como máximo 80 caracteres'),
    description: z.string().trim().max(500, 'Como máximo 500 caracteres'),
    subjectId: z.string(),
    date: z.string(),
    time: z.string(),
  })
  .refine((values) => !values.time || values.date, { message: 'Elige también el día', path: ['date'] });

export function RoomForm({ room, onDone, onCancel }) {
  const { subjects } = useSubjects();
  const create = useCreateRoom();
  const update = useUpdateRoom();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: room?.name ?? '',
      description: room?.description ?? '',
      subjectId: room?.subject ? KEEP : '',
      date: toDateInput(room?.scheduledAt),
      time: room?.scheduledAt ? toTimeInput(room.scheduledAt) || '23:59' : '',
    },
  });

  const onSubmit = handleSubmit(async ({ date, time, subjectId, ...values }) => {
    const payload = {
      ...values,
      scheduledAt: date ? combineDateTime(date, time || '18:00').toISOString() : null,
      ...(subjectId === KEEP ? {} : { subjectId: subjectId || null }),
    };
    try {
      const saved = room ? await update.mutateAsync({ id: room._id, data: payload }) : await create.mutateAsync(payload);
      onDone?.(saved);
    } catch (error) {
      applyFieldErrors(setError, error, { scheduledAt: 'date' });
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <Field label="Nombre" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Ej. Preparar el parcial de Redes" autoFocus autoComplete="off" />
      </Field>
      <Field label="Asignatura" optional hint="Se toma de tus asignaturas y la ven todos los participantes.">
        <Select {...register('subjectId')}>
          {room?.subject ? <option value={KEEP}>{room.subject.name} (actual)</option> : null}
          <option value="">Sin asignatura</option>
          {subjects.map((subject) => (
            <option key={subject._id} value={subject._id}>
              {subject.name}
            </option>
          ))}
        </Select>
      </Field>
      <FormRow>
        <Field label="Fecha de la sesión" optional error={errors.date?.message}>
          <Input type="date" {...register('date')} />
        </Field>
        <Field label="Hora" optional>
          <Input type="time" {...register('time')} />
        </Field>
      </FormRow>
      <Field label="Descripción" optional error={errors.description?.message}>
        <Textarea {...register('description')} rows={3} placeholder="Qué vais a preparar y cómo os organizáis" />
      </Field>
      <OverlayFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {room ? 'Guardar cambios' : 'Crear sala'}
        </Button>
      </OverlayFooter>
    </form>
  );
}

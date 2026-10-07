import { zodResolver } from '@hookform/resolvers/zod';
import { Check } from '@phosphor-icons/react';
import clsx from 'clsx';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateSubject, useSubjects, useUpdateSubject } from '../../hooks/useSubjects.js';
import { applyFieldErrors } from '../../utils/errors.js';
import { SUBJECT_COLORS, nextFreeColor, subjectColor } from '../../utils/subjects.js';
import { Button } from '../ui/Button.jsx';
import { Field, Input, Textarea } from '../ui/Form.jsx';
import { OverlayFooter } from '../ui/Overlay.jsx';
import styles from './Subjects.module.css';

const schema = z.object({
  name: z.string().trim().min(1, 'Ponle nombre a la asignatura').max(60, 'Como máximo 60 caracteres'),
  description: z.string().trim().max(300, 'Como máximo 300 caracteres'),
  color: z.enum(SUBJECT_COLORS.map((color) => color.value)),
});

export function ColorPicker({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Color" className={styles.colors}>
      {SUBJECT_COLORS.map((color) => (
        <label key={color.value} className={clsx(styles.color, value === color.value && styles.colorActive)} title={color.label}>
          <input
            type="radio"
            name="subject-color"
            value={color.value}
            checked={value === color.value}
            onChange={() => onChange(color.value)}
            className="visually-hidden"
          />
          <span className={styles.swatch} style={{ background: subjectColor(color.value) }}>
            {value === color.value ? <Check size={16} weight="bold" aria-hidden /> : null}
          </span>
          <span className="visually-hidden">{color.label}</span>
        </label>
      ))}
    </div>
  );
}

export function SubjectForm({ subject, onDone, onCancel }) {
  const { subjects } = useSubjects();
  const create = useCreateSubject();
  const update = useUpdateSubject();
  const {
    register,
    control,
    handleSubmit,
    setError,
    watch,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
    defaultValues: {
      name: subject?.name ?? '',
      description: subject?.description ?? '',
      color: subject?.color ?? nextFreeColor(subjects),
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (subject) await update.mutateAsync({ id: subject._id, data: values });
      else await create.mutateAsync(values);
      onDone?.();
    } catch (error) {
      applyFieldErrors(setError, error);
    }
  });

  const name = watch('name');
  const color = watch('color');

  return (
    <form onSubmit={onSubmit} noValidate className={styles.form}>
      <Field label="Nombre" error={errors.name?.message}>
        <Input {...register('name')} placeholder="Ej. Cálculo II" autoFocus autoComplete="off" />
      </Field>
      <Field label="Color" hint="Se usa en tus tareas, el calendario y las notas.">
        <Controller control={control} name="color" render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />} />
      </Field>
      <p className={styles.preview} aria-hidden>
        <span className="swipe" style={{ '--swipe': subjectColor(color) }}>
          {name?.trim() || 'Así se verá'}
        </span>
      </p>
      <Field label="Descripción" optional error={errors.description?.message}>
        <Textarea {...register('description')} rows={3} placeholder="Profesor, horario, temario…" />
      </Field>
      <OverlayFooter>
        <Button variant="secondary" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={create.isPending || update.isPending}>
          {subject ? 'Guardar cambios' : 'Crear asignatura'}
        </Button>
      </OverlayFooter>
    </form>
  );
}

import { Books, PencilSimple, Plus, Trash } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { SubjectForm } from '../components/subjects/SubjectForm.jsx';
import styles from '../components/subjects/Subjects.module.css';
import { Button, IconButton } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/Feedback.jsx';
import { Modal } from '../components/ui/Overlay.jsx';
import { Page, PageHeader } from '../components/ui/Page.jsx';
import { SubjectTag } from '../components/ui/SubjectTag.jsx';
import { useGradeStats } from '../hooks/useGrades.js';
import { useDeleteSubject, useSubjects } from '../hooks/useSubjects.js';
import { confirm } from '../store/confirmStore.js';
import { formatAverage } from '../utils/format.js';

export default function SubjectsPage() {
  const { subjects } = useSubjects();
  const { data: stats } = useGradeStats();
  const remove = useDeleteSubject();
  const [editing, setEditing] = useState(null); // null | 'new' | subject

  const statsById = useMemo(
    () => new Map((stats?.bySubject ?? []).filter((row) => row.subject).map((row) => [row.subject._id, row])),
    [stats],
  );

  const handleDelete = async (subject) => {
    const row = statsById.get(subject._id);
    const ok = await confirm({
      title: `¿Eliminar ${subject.name}?`,
      description: row?.total
        ? `Sus ${row.total} tareas no se borran: se quedarán sin asignatura.`
        : 'No tiene tareas asociadas.',
      confirmLabel: 'Eliminar asignatura',
      tone: 'danger',
    });
    if (ok) remove.mutate(subject._id);
  };

  return (
    <Page title="Asignaturas" width="medium">
      <PageHeader
        title="Asignaturas"
        lead="Cada asignatura tiene su color: lo verás en tus tareas, el calendario y las notas."
        actions={
          subjects.length ? (
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Nueva asignatura
            </Button>
          ) : null
        }
      />

      {subjects.length === 0 ? (
        <EmptyState
          icon={Books}
          title="Aún no tienes asignaturas"
          action={
            <Button icon={Plus} onClick={() => setEditing('new')}>
              Crear la primera
            </Button>
          }
        >
          Crea las asignaturas de este curso para agrupar tus tareas y ver tu media en cada una.
        </EmptyState>
      ) : (
        <>
          <div className={styles.headerRow} aria-hidden>
            <span>Asignatura</span>
            <span>Pendientes</span>
            <span>Completadas</span>
            <span>Media</span>
            <span />
          </div>
          <ul className={styles.list}>
            {subjects.map((subject) => {
              const row = statsById.get(subject._id);
              return (
                <li key={subject._id} className={styles.row}>
                  <div className={styles.identity}>
                    <span className={styles.name}>
                      <SubjectTag subject={subject} size="lg" />
                    </span>
                    {subject.description ? <p className={styles.description}>{subject.description}</p> : null}
                  </div>
                  <span className={row?.overdue ? `${styles.stat} ${styles.statAlert}` : styles.stat}>
                    <strong>{row?.pending ?? 0}</strong>
                    {row?.overdue ? `${row.overdue} atrasadas` : 'pendientes'}
                  </span>
                  <span className={styles.stat}>
                    <strong>{row?.completed ?? 0}</strong>completadas
                  </span>
                  <span className={styles.stat}>
                    <strong>{formatAverage(row?.average)}</strong>
                    {row?.graded ? `media de ${row.graded}` : 'sin notas'}
                  </span>
                  <span className={styles.rowActions}>
                    <IconButton icon={PencilSimple} label={`Editar ${subject.name}`} onClick={() => setEditing(subject)} />
                    <IconButton icon={Trash} label={`Eliminar ${subject.name}`} onClick={() => handleDelete(subject)} />
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <Modal
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing === 'new' ? 'Nueva asignatura' : 'Editar asignatura'}
      >
        {editing ? (
          <SubjectForm subject={editing === 'new' ? null : editing} onDone={() => setEditing(null)} onCancel={() => setEditing(null)} />
        ) : null}
      </Modal>
    </Page>
  );
}

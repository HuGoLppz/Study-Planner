import { FileX } from '@phosphor-icons/react';
import { useTask } from '../../hooks/useTasks.js';
import { useUiStore } from '../../store/uiStore.js';
import { EmptyState, ErrorState, Skeleton } from '../ui/Feedback.jsx';
import { Drawer } from '../ui/Overlay.jsx';
import { TaskDetail } from './TaskDetail.jsx';
import { TaskForm } from './TaskForm.jsx';

// Panel global de tarea: ver, crear o editar desde cualquier pantalla.
export function TaskDrawer() {
  const panel = useUiStore((state) => state.taskPanel);
  const openTask = useUiStore((state) => state.openTask);
  const editTask = useUiStore((state) => state.editTask);
  const closeTask = useUiStore((state) => state.closeTask);

  const taskId = panel?.mode === 'create' ? null : panel?.taskId;
  const { data: task, isPending, error, refetch } = useTask(taskId);

  const title =
    panel?.mode === 'create' ? 'Nueva tarea' : panel?.mode === 'edit' ? 'Editar tarea' : task?.title ?? 'Tarea';

  let content = null;
  if (panel?.mode === 'create') {
    content = <TaskForm defaults={panel.defaults} onDone={closeTask} onCancel={closeTask} />;
  } else if (taskId && isPending) {
    content = (
      <div style={{ display: 'grid', gap: 12 }} aria-label="Cargando tarea">
        <Skeleton width="40%" height={24} />
        <Skeleton height={120} />
        <Skeleton height={80} />
      </div>
    );
  } else if (error?.status === 404) {
    content = (
      <EmptyState icon={FileX} title="Esta tarea ya no existe">
        Puede que la hayas eliminado desde otro dispositivo.
      </EmptyState>
    );
  } else if (error) {
    content = <ErrorState error={error} onRetry={refetch} />;
  } else if (task && panel?.mode === 'edit') {
    content = <TaskForm task={task} onDone={() => openTask(task._id)} onCancel={() => openTask(task._id)} />;
  } else if (task) {
    content = (
      <TaskDetail task={task} onEdit={() => editTask(task._id)} onDeleted={closeTask} focusGrade={panel?.focus === 'grade'} />
    );
  }

  return (
    <Drawer open={Boolean(panel)} onOpenChange={(open) => !open && closeTask()} title={title}>
      {content}
    </Drawer>
  );
}

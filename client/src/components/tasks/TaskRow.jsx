import clsx from 'clsx';
import { useSubjects } from '../../hooks/useSubjects.js';
import { useCompleteTask, useReopenTask } from '../../hooks/useTasks.js';
import { useUiStore } from '../../store/uiStore.js';
import { isCompleted } from '../../utils/tasks.js';
import { SubjectTag } from '../ui/SubjectTag.jsx';
import { DueLabel, GradeBadge, PriorityMark, TaskCheck, TaskType } from './TaskBits.jsx';
import styles from './Tasks.module.css';

export function TaskRow({ task, now, compact = false }) {
  const { get } = useSubjects();
  const openTask = useUiStore((state) => state.openTask);
  const complete = useCompleteTask();
  const reopen = useReopenTask();
  const done = isCompleted(task);

  const toggle = () => (done ? reopen.mutate(task._id) : complete.mutate({ id: task._id }));

  return (
    <li className={clsx(styles.row, done && styles.rowDone, compact && styles.rowCompact)}>
      <TaskCheck task={task} now={now} onToggle={toggle} disabled={complete.isPending || reopen.isPending} />
      <button type="button" className={styles.rowMain} onClick={() => openTask(task._id)}>
        <span className={styles.rowTitle}>{task.title}</span>
        <span className={styles.rowMeta}>
          <SubjectTag subject={get(task.subject)} size="sm" fallback={compact ? null : 'Sin asignatura'} />
          {!compact ? <TaskType type={task.type} /> : null}
          {done && task.grade ? <GradeBadge score={task.grade.score} /> : null}
        </span>
      </button>
      <span className={styles.rowAside}>
        <DueLabel task={task} now={now} />
        {!compact && !done ? <PriorityMark priority={task.priority} /> : null}
      </span>
    </li>
  );
}

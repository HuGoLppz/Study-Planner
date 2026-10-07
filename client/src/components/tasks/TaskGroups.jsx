import clsx from 'clsx';
import { TaskRow } from './TaskRow.jsx';
import styles from './Tasks.module.css';

// Lista de tareas agrupada por tramos ("Atrasadas", "Hoy", "Esta semana"…).
export function TaskGroups({ groups, now }) {
  return (
    <div className={styles.groups}>
      {groups.map((group) => (
        <section key={group.key} className={styles.group} aria-label={group.label}>
          <h2 className={clsx(styles.groupTitle, group.key === 'overdue' && styles.groupOverdue)}>
            {group.label}
            <span className={styles.groupCount}>{group.items.length}</span>
          </h2>
          <ul className={styles.list}>
            {group.items.map((task) => (
              <TaskRow key={task._id} task={task} now={now} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function TaskList({ tasks, now, compact = false }) {
  return (
    <ul className={styles.list}>
      {tasks.map((task) => (
        <TaskRow key={task._id} task={task} now={now} compact={compact} />
      ))}
    </ul>
  );
}

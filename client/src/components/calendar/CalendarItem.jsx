import { ChatsCircle, Check } from '@phosphor-icons/react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { useUiStore } from '../../store/uiStore.js';
import { formatTime, hasTime } from '../../utils/dates.js';
import { subjectColor } from '../../utils/subjects.js';
import { TaskTypeIcon } from '../tasks/TaskBits.jsx';
import styles from './Calendar.module.css';

// Abre la tarea en el panel lateral o navega a la sala del evento.
export function useOpenItem() {
  const openTask = useUiStore((state) => state.openTask);
  const navigate = useNavigate();
  return (item) => (item.kind === 'task' ? openTask(item.id) : navigate(`/salas/${item.event.roomId}`));
}

export function CalendarChip({ item, showTime = false, onOpen }) {
  const Icon = item.kind === 'task' ? null : ChatsCircle;
  return (
    <button
      type="button"
      className={clsx(styles.chip, item.kind !== 'task' && styles.chipRoom, item.done && styles.chipDone, item.overdue && styles.chipLate, !item.color && styles.chipPlain)}
      style={{ '--chip': item.color && item.kind === 'task' ? subjectColor(item.color) : undefined }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(item);
      }}
      title={item.title}
    >
      {item.done ? <Check size={12} weight="bold" aria-hidden /> : Icon ? <Icon size={12} weight="bold" aria-hidden /> : <TaskTypeIcon type={item.type} size={12} weight="bold" />}
      {showTime && hasTime(item.date) ? <span className={styles.chipTime}>{formatTime(item.date)}</span> : null}
      <span className={styles.chipText}>{item.title}</span>
      {item.done ? <span className="visually-hidden"> (completada)</span> : null}
      {item.overdue ? <span className="visually-hidden"> (atrasada)</span> : null}
    </button>
  );
}

// Fila de lista (agenda y móvil): más espacio para el título y la hora.
export function CalendarRow({ item, onOpen }) {
  return (
    <button type="button" className={clsx(styles.row, item.done && styles.rowDone)} onClick={() => onOpen(item)}>
      <span className={styles.rowTime}>{hasTime(item.date) ? formatTime(item.date) : 'Todo el día'}</span>
      <span
        className={clsx(styles.rowMark, item.kind !== 'task' && styles.rowMarkRoom)}
        style={{ '--chip': item.color ? subjectColor(item.color) : undefined }}
        aria-hidden
      />
      <span className={styles.rowBody}>
        <span className={clsx(styles.rowTitle, item.overdue && 'overdue-text')}>{item.title}</span>
        <span className={styles.rowMeta}>
          {item.kind === 'task'
            ? item.done
              ? 'Completada'
              : item.overdue
                ? 'Atrasada'
                : 'Tarea'
            : item.kind === 'session'
              ? `Sala ${item.event.roomName}`
              : `Tarea en ${item.event.roomName}`}
        </span>
      </span>
    </button>
  );
}

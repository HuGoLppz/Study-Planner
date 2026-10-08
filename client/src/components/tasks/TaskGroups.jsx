import clsx from "clsx";
import { TaskRow } from "./TaskRow.jsx";

// Lista de tareas agrupada por tramos ("Atrasadas", "Hoy", "Esta semana"…).
export function TaskGroups({ groups, now }) {
  return (
    <div className="tasks-groups">
      {groups.map((group) => (
        <section key={group.key} aria-label={group.label}>
          <h2
            className={clsx(
              "tasks-group-title",
              group.key === "overdue" && "tasks-group-overdue",
            )}
          >
            {group.label}
            <span className="tasks-group-count">{group.items.length}</span>
          </h2>
          <ul className="tasks-list">
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
    <ul className="tasks-list">
      {tasks.map((task) => (
        <TaskRow key={task._id} task={task} now={now} compact={compact} />
      ))}
    </ul>
  );
}

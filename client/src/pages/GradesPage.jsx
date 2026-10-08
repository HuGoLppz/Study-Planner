import { ChartLineUp, Exam } from "@phosphor-icons/react";
import { addWeeks, startOfWeek } from "date-fns";
import { useMemo } from "react";
import { AverageBars } from "../components/charts/AverageBars.jsx";
import { ColumnChart } from "../components/charts/ColumnChart.jsx";
import { EvolutionChart } from "../components/charts/EvolutionChart.jsx";
import { ProgressMeter } from "../components/charts/ProgressMeter.jsx";
import { TaskTypeIcon } from "../components/tasks/TaskBits.jsx";
import { Button } from "../components/ui/Button.jsx";
import { SkeletonBody } from "../components/ui/AppSkeleton.jsx";
import {
  EmptyState,
  ErrorState,
  Skeleton,
} from "../components/ui/Feedback.jsx";
import { Page, PageHeader, Section } from "../components/ui/Page.jsx";
import { SubjectDot, SubjectTag } from "../components/ui/SubjectTag.jsx";
import { useGradedTasks, useGradeStats } from "../hooks/useGrades.js";
import { useSubjects } from "../hooks/useSubjects.js";
import { useUngradedTasks } from "../hooks/useTasks.js";
import { useUiStore } from "../store/uiStore.js";
import { WEEK, dayKey, fmt } from "../utils/dates.js";
import {
  formatAverage,
  formatGrade,
  gradeBand,
  plural,
} from "../utils/format.js";
import { TYPE_LABEL } from "../utils/tasks.js";

const WEEKS = 12;

// Semanas sin tareas completadas también cuentan (valen 0): el ritmo se lee sin huecos.
function weeklySeries(weekly) {
  const counts = new Map(
    weekly.map((week) => [dayKey(new Date(week.weekStart)), week.completed]),
  );
  const first = addWeeks(startOfWeek(new Date(), WEEK), -(WEEKS - 1));
  return Array.from({ length: WEEKS }, (_, index) => {
    const start = addWeeks(first, index);
    return {
      key: dayKey(start),
      value: counts.get(dayKey(start)) ?? 0,
      label: `Semana del ${fmt(start, "d 'de' MMMM")}`,
      short: index === WEEKS - 1 ? "actual" : fmt(start, "d/M"),
    };
  });
}

export default function GradesPage() {
  const stats = useGradeStats();
  const graded = useGradedTasks();
  const ungraded = useUngradedTasks();
  const { get } = useSubjects();
  const openTask = useUiStore((state) => state.openTask);
  const data = stats.data;

  const weeks = useMemo(() => (data ? weeklySeries(data.weekly) : []), [data]);

  if (stats.isPending) {
    return (
      <Page title="Notas">
        <SkeletonBody variant="grades" header />
      </Page>
    );
  }
  if (stats.isError) {
    return (
      <Page title="Notas">
        <ErrorState error={stats.error} onRetry={stats.refetch} />
      </Page>
    );
  }

  const hasGrades = data.average != null;

  return (
    <Page title="Notas">
      <PageHeader
        title="Notas"
        lead={
          hasGrades
            ? `${plural(data.totals.graded, "tarea evaluada", "tareas evaluadas")} de ${plural(data.totals.completed, "completada", "completadas")}.`
            : "Cuando completes una tarea podrás ponerle nota de 0 a 10. Aquí verás tu media y cómo evoluciona."
        }
      />

      {hasGrades ? (
        <div className="grades-hero">
          <div className="grades-hero-figure">
            <span className="grades-hero-label">Media general</span>
            <span className="grades-hero-value">
              {formatAverage(data.average)}
            </span>
            <span className="grades-hero-band">{gradeBand(data.average)}</span>
          </div>
          <dl className="grades-facts">
            <div>
              <dt>Mejor nota</dt>
              <dd>{formatGrade(data.best)}</dd>
            </div>
            <div>
              <dt>Nota más baja</dt>
              <dd>{formatGrade(data.lowest)}</dd>
            </div>
            <div>
              <dt>Completadas sin nota</dt>
              <dd>{data.totals.ungraded}</dd>
            </div>
          </dl>
        </div>
      ) : null}

      <div className="grades-layout">
        <Section
          title="Evolución"
          id="grades-evolution"
          className="grades-wide"
          description="Cada punto es una nota; la línea, tu media acumulada."
        >
          {data.evolution.length >= 2 ? (
            <EvolutionChart points={data.evolution} />
          ) : (
            <EmptyState
              icon={ChartLineUp}
              title="Necesitas al menos dos notas"
              compact
            >
              {data.evolution.length === 1
                ? `Tienes una nota (${formatGrade(data.evolution[0].score)}). Con la siguiente verás cómo evoluciona tu media.`
                : "Pon nota a tus tareas completadas para ver aquí la evolución."}
            </EmptyState>
          )}
        </Section>

        <Section title="Media por asignatura" id="grades-subjects">
          {data.bySubject.some((row) => row.graded > 0) ? (
            <AverageBars
              rows={data.bySubject.filter((row) => row.graded > 0)}
              overall={data.average}
            />
          ) : (
            <p className="muted small">Todavía no hay notas por asignatura.</p>
          )}
        </Section>

        <Section
          title="Progreso por asignatura"
          id="grades-progress"
          description="Tareas completadas sobre el total."
        >
          {data.bySubject.length === 0 ? (
            <p className="muted small">
              Cuando tengas tareas verás aquí cuánto llevas hecho de cada
              asignatura.
            </p>
          ) : (
            <ul className="grades-progress-list">
              {data.bySubject.map((row) => (
                <li
                  key={row.subject?._id ?? "none"}
                  className="grades-progress-row"
                >
                  <span className="grades-progress-name">
                    <SubjectDot color={row.subject?.color} />
                    <span className="truncate">
                      {row.subject?.name ?? "Sin asignatura"}
                    </span>
                  </span>
                  <ProgressMeter
                    completed={row.completed}
                    pending={row.pending}
                    overdue={row.overdue}
                    showLegend={false}
                    size="sm"
                  />
                  <span className="grades-progress-count">
                    {row.completed} de {row.total}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Ritmo de trabajo"
          id="grades-weekly"
          description="Tareas completadas por semana, últimas 12 semanas."
        >
          <ColumnChart
            data={weeks}
            valueLabel="tareas completadas"
            ariaLabel="Tareas completadas por semana"
          />
        </Section>

        <Section title="Pendientes de nota" id="grades-ungraded">
          {ungraded.isPending ? (
            <Skeleton height={80} />
          ) : (ungraded.data ?? []).length === 0 ? (
            <p className="muted small">
              Todas tus tareas completadas tienen nota.
            </p>
          ) : (
            <ul className="grades-ungraded">
              {ungraded.data.slice(0, 6).map((task) => (
                <li key={task._id} className="grades-ungraded-row">
                  <span className="grades-ungraded-title">
                    <span className="truncate">{task.title}</span>
                    <SubjectTag
                      subject={get(task.subject)}
                      size="sm"
                      fallback={null}
                    />
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => openTask(task._id, { focus: "grade" })}
                  >
                    Poner nota
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section
          title="Registro de notas"
          id="grades-table"
          className="grades-wide"
        >
          {graded.isPending ? (
            <Skeleton height={160} />
          ) : (graded.data ?? []).length === 0 ? (
            <EmptyState icon={Exam} title="Sin notas registradas" compact>
              Completa una tarea y ponle nota desde su ficha.
            </EmptyState>
          ) : (
            <table className="grades-table">
              <thead>
                <tr>
                  <th scope="col">Tarea</th>
                  <th scope="col">Asignatura</th>
                  <th scope="col">Tipo</th>
                  <th scope="col">Fecha</th>
                  <th scope="col" className="grades-num">
                    Nota
                  </th>
                </tr>
              </thead>
              <tbody>
                {graded.data.map((task) => (
                  <tr key={task._id} onClick={() => openTask(task._id)}>
                    <th scope="row">
                      <button
                        type="button"
                        className="grades-table-link"
                        onClick={() => openTask(task._id)}
                      >
                        {task.title}
                      </button>
                    </th>
                    <td data-label="Asignatura">
                      <SubjectTag subject={get(task.subject)} size="sm" />
                    </td>
                    <td data-label="Tipo">
                      <span className="grades-type">
                        <TaskTypeIcon type={task.type} size={14} />{" "}
                        {TYPE_LABEL[task.type]}
                      </span>
                    </td>
                    <td data-label="Fecha">
                      {fmt(task.dueDate, "d MMM yyyy")}
                    </td>
                    <td data-label="Nota" className="grades-num">
                      <strong
                        className={
                          task.grade.score < 5 ? "overdue-text" : undefined
                        }
                      >
                        {formatGrade(task.grade.score)}
                      </strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>
      </div>
    </Page>
  );
}

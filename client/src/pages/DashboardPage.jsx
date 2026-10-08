import { CheckCircle, Plus, Timer } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import {
  EventsBlock,
  FocusBlock,
  FriendsBlock,
  GradesBlock,
  NotificationsBlock,
  ProgressBlock,
  RoomsBlock,
} from "../components/dashboard/DashboardBlocks.jsx";
import { Horizon } from "../components/dashboard/Horizon.jsx";
import { TaskList } from "../components/tasks/TaskGroups.jsx";
import { Button } from "../components/ui/Button.jsx";
import { SkeletonBody } from "../components/ui/AppSkeleton.jsx";
import { EmptyState, ErrorState } from "../components/ui/Feedback.jsx";
import { Page, Section } from "../components/ui/Page.jsx";
import { useDashboard } from "../hooks/useDashboard.js";
import { useNow } from "../hooks/useUi.js";
import { useUiStore } from "../store/uiStore.js";
import { buildHeadline } from "../utils/dashboard.js";
import { formatLongDate } from "../utils/dates.js";

export default function DashboardPage() {
  const now = useNow();
  const { data, isPending, isError, error, refetch } = useDashboard();
  const createTask = useUiStore((state) => state.createTask);

  return (
    <Page title="Hoy">
      {isPending ? (
        <SkeletonBody variant="dashboard" />
      ) : isError ? (
        <ErrorState
          title="No se ha podido cargar tu día"
          error={error}
          onRetry={refetch}
        />
      ) : (
        <DashboardContent data={data} now={now} onCreate={() => createTask()} />
      )}
    </Page>
  );
}

function DashboardContent({ data, now, onCreate }) {
  const { title, lead } = buildHeadline({
    horizon: data.horizon,
    summary: data.summary,
    now,
  });
  const upcoming = data.horizon
    .filter((task) => new Date(task.dueDate) >= now)
    .slice(0, 6);

  return (
    <>
      <header className="dashboard-hero">
        <div className="dashboard-hero-text">
          <p className="dashboard-today">{formatLongDate(now)}</p>
          <h1 className={`display dashboard-headline`}>{title}</h1>
          <p className="dashboard-lead">{lead}</p>
        </div>
        <div className="dashboard-hero-actions">
          <Button as={Link} to="/pomodoro" variant="secondary" icon={Timer}>
            Pomodoro
          </Button>
          <Button icon={Plus} onClick={onCreate}>
            Nueva tarea
          </Button>
        </div>
      </header>

      <Horizon tasks={data.horizon} events={data.events} now={now} />

      <div className="dashboard-columns">
        <div className="dashboard-main">
          {data.overdue.length > 0 ? (
            <Section
              title="Atrasadas"
              id="dash-overdue"
              className="dashboard-overdue"
              action={
                data.summary.overdue > data.overdue.length ? (
                  <Link
                    to="/tareas?estado=overdue"
                    className="dashboard-more-link"
                  >
                    Ver las {data.summary.overdue}
                  </Link>
                ) : null
              }
            >
              <TaskList tasks={data.overdue} now={now} compact />
            </Section>
          ) : null}

          <Section
            title="Lo próximo"
            id="dash-next"
            action={
              <Link to="/tareas" className="dashboard-more-link">
                Ver todas
              </Link>
            }
          >
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CheckCircle}
                title={
                  data.summary.total === 0
                    ? "Aún no tienes tareas"
                    : "Nada pendiente en dos semanas"
                }
                compact
                action={
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={onCreate}
                  >
                    Añadir tarea
                  </Button>
                }
              >
                {data.summary.total === 0
                  ? "Apunta entregas, exámenes o lecturas con su fecha para verlas aquí."
                  : "Buen momento para adelantar trabajo o repasar."}
              </EmptyState>
            ) : (
              <TaskList tasks={upcoming} now={now} compact />
            )}
          </Section>

          <EventsBlock events={data.events} now={now} />
        </div>

        <aside className="dashboard-side" aria-label="Resumen académico">
          <GradesBlock grades={data.grades} />
          <ProgressBlock progress={data.progress} />
          <FocusBlock pomodoro={data.pomodoro} />
        </aside>
      </div>

      <div className="dashboard-people">
        <RoomsBlock rooms={data.rooms} />
        <FriendsBlock friends={data.friends} />
        <NotificationsBlock notifications={data.notifications} />
      </div>
    </>
  );
}

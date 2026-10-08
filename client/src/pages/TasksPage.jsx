import {
  CheckCircle,
  ListChecks,
  MagnifyingGlass,
  Plus,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ProgressMeter } from "../components/charts/ProgressMeter.jsx";
import { TaskFilters } from "../components/tasks/TaskFilters.jsx";
import { TaskGroups } from "../components/tasks/TaskGroups.jsx";
import { Button } from "../components/ui/Button.jsx";
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from "../components/ui/Feedback.jsx";
import { Page, PageHeader } from "../components/ui/Page.jsx";
import { Segmented } from "../components/ui/Tabs.jsx";
import { useTaskList, useTaskSummary } from "../hooks/useTasks.js";
import { useDebouncedValue, useNow } from "../hooks/useUi.js";
import { useUiStore } from "../store/uiStore.js";
import { groupByCompletion, groupByDue } from "../utils/tasks.js";

const PARAM = {
  status: "estado",
  subject: "asignatura",
  type: "tipo",
  priority: "urgencia",
  q: "q",
};

const EMPTY_COPY = {
  pending: {
    title: "No tienes nada pendiente",
    text: "Apunta tu próxima entrega para no perderla de vista.",
  },
  overdue: {
    title: "Ninguna tarea atrasada",
    text: "Vas al día con todas tus entregas.",
  },
  completed: {
    title: "Aún no has completado ninguna tarea",
    text: "Cuando marques una tarea como hecha aparecerá aquí con su nota.",
  },
  all: {
    title: "Aún no tienes tareas",
    text: "Crea tu primera tarea con su fecha de entrega y asignatura.",
  },
};

export default function TasksPage() {
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const createTask = useUiStore((state) => state.createTask);
  const openTask = useUiStore((state) => state.openTask);

  const values = Object.fromEntries(
    Object.entries(PARAM).map(([key, param]) => [key, params.get(param) ?? ""]),
  );
  const status = values.status || "pending";
  const [query, setQuery] = useState(values.q);
  const debouncedQuery = useDebouncedValue(query.trim(), 300);

  const setValue = (key, value) => {
    if (key === "q") return setQuery(value);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (value) next.set(PARAM[key], value);
        else next.delete(PARAM[key]);
        return next;
      },
      { replace: true },
    );
  };

  // La búsqueda se escribe en la URL con retardo para no recargar en cada tecla.
  useEffect(() => {
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (debouncedQuery) next.set("q", debouncedQuery);
        else next.delete("q");
        return next;
      },
      { replace: true },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

  // Enlaces directos a una tarea: /tareas?tarea=<id>
  useEffect(() => {
    const taskId = params.get("tarea");
    if (taskId) {
      openTask(taskId);
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          next.delete("tarea");
          return next;
        },
        { replace: true },
      );
    }
  }, [params, openTask, setParams]);

  const filters = useMemo(
    () => ({
      status,
      subject: values.subject || undefined,
      type: values.type || undefined,
      priority: values.priority || undefined,
      q: debouncedQuery || undefined,
      sort: status === "completed" ? "completed" : "due",
    }),
    [status, values.subject, values.type, values.priority, debouncedQuery],
  );

  const { data: summary } = useTaskSummary();
  const list = useTaskList(filters);
  const tasks = useMemo(
    () => list.data?.pages.flatMap((page) => page.items) ?? [],
    [list.data],
  );
  const groups = useMemo(
    () =>
      status === "completed"
        ? groupByCompletion(tasks)
        : groupByDue(tasks, now),
    [tasks, status, now],
  );

  const activeFilters = ["subject", "type", "priority"].filter(
    (key) => values[key],
  ).length;
  const filtering = activeFilters > 0 || Boolean(debouncedQuery);

  const clearFilters = () => {
    setQuery("");
    setParams(
      (current) => {
        const next = new URLSearchParams();
        if (current.get("estado")) next.set("estado", current.get("estado"));
        return next;
      },
      { replace: true },
    );
  };

  return (
    <Page title="Tareas">
      <PageHeader
        title="Tareas"
        actions={
          <Button
            icon={Plus}
            onClick={() => createTask()}
            className="tasks-page-new-button"
          >
            Nueva tarea
          </Button>
        }
      >
        {summary && summary.total > 0 ? (
          <div className="tasks-page-summary">
            <ProgressMeter
              completed={summary.completed}
              pending={summary.pending}
              overdue={summary.overdue}
              size="sm"
            />
          </div>
        ) : null}
      </PageHeader>

      <Segmented
        label="Estado de las tareas"
        value={status}
        onChange={(value) =>
          setValue("status", value === "pending" ? "" : value)
        }
        options={[
          { value: "pending", label: "Pendientes", count: summary?.pending },
          {
            value: "overdue",
            label: "Atrasadas",
            count: summary?.overdue,
            tone: summary?.overdue ? "alert" : undefined,
          },
          {
            value: "completed",
            label: "Completadas",
            count: summary?.completed,
          },
          { value: "all", label: "Todas", count: summary?.total },
        ]}
      />

      <TaskFilters
        values={{ ...values, q: query }}
        onChange={setValue}
        onClear={clearFilters}
        activeCount={activeFilters}
      />

      <div
        className="tasks-page-results"
        data-stale={list.isPlaceholderData || undefined}
      >
        {list.isPending ? (
          <SkeletonList rows={6} label="Cargando tareas" />
        ) : list.isError ? (
          <ErrorState error={list.error} onRetry={list.refetch} />
        ) : tasks.length === 0 ? (
          filtering ? (
            <EmptyState
              icon={MagnifyingGlass}
              title="Ninguna tarea coincide"
              action={
                <Button variant="secondary" size="sm" onClick={clearFilters}>
                  Quitar filtros
                </Button>
              }
            >
              Prueba con otras palabras o quita algún filtro.
            </EmptyState>
          ) : (
            <EmptyState
              icon={status === "overdue" ? CheckCircle : ListChecks}
              title={EMPTY_COPY[status].title}
              action={
                status !== "overdue" ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={Plus}
                    onClick={() => createTask()}
                  >
                    Nueva tarea
                  </Button>
                ) : null
              }
            >
              {EMPTY_COPY[status].text}
            </EmptyState>
          )
        ) : (
          <>
            <TaskGroups groups={groups} now={now} />
            {list.hasNextPage ? (
              <Button
                variant="secondary"
                className="tasks-page-more"
                onClick={() => list.fetchNextPage()}
                loading={list.isFetchingNextPage}
              >
                Cargar más tareas
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Page>
  );
}

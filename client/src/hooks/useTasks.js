import {
  keepPreviousData,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { tasksApi } from "../services/api.js";
import { useUiStore } from "../store/uiStore.js";
import { getErrorMessage } from "../utils/errors.js";
import { invalidateAcademic, qk } from "./queryKeys.js";

const PAGE_SIZE = 100;

export function useTaskList(filters) {
  return useInfiniteQuery({
    queryKey: qk.tasks.list(filters),
    queryFn: ({ pageParam }) =>
      tasksApi.list({ ...filters, page: pageParam, limit: PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    placeholderData: keepPreviousData,
  });
}

export function useTasksInRange(from, to) {
  return useQuery({
    queryKey: qk.tasks.range(from.toISOString(), to.toISOString()),
    queryFn: () =>
      tasksApi
        .list({
          from: from.toISOString(),
          to: to.toISOString(),
          limit: 200,
          sort: "due",
        })
        .then((data) => data.items),
    placeholderData: keepPreviousData,
  });
}

export function useTask(taskId) {
  return useQuery({
    queryKey: qk.tasks.detail(taskId),
    queryFn: () => tasksApi.get(taskId),
    enabled: Boolean(taskId),
  });
}

export function useTaskSummary() {
  return useQuery({ queryKey: qk.tasks.summary, queryFn: tasksApi.summary });
}

// Completadas sin nota: la página de notas las ofrece para calificarlas.
export function useUngradedTasks() {
  return useQuery({
    queryKey: qk.tasks.completed,
    queryFn: () =>
      tasksApi
        .list({ status: "completed", sort: "completed", limit: 100 })
        .then((data) => data.items.filter((task) => !task.grade)),
  });
}

// Aplica un cambio a la tarea en todas las listas en caché (respuesta inmediata en la interfaz).
function patchCachedTask(queryClient, task) {
  queryClient.setQueryData(qk.tasks.detail(task._id), task);
  queryClient.setQueriesData({ queryKey: ["tasks", "list"] }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) =>
              item._id === task._id ? { ...item, ...task } : item,
            ),
          })),
        }
      : data,
  );
  queryClient.setQueriesData({ queryKey: ["tasks", "range"] }, (items) =>
    Array.isArray(items)
      ? items.map((item) =>
          item._id === task._id ? { ...item, ...task } : item,
        )
      : items,
  );
}

function useTaskMutation(mutationFn, { success, onDone } = {}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (task, variables) => {
      if (task?._id) patchCachedTask(queryClient, task);
      invalidateAcademic(queryClient);
      const message =
        typeof success === "function" ? success(task, variables) : success;
      if (message) toast.success(message);
      onDone?.(task, variables);
    },
    // Los errores de campo los muestra el formulario junto a cada campo.
    onError: (error) => {
      if (!error.fields) toast.error(getErrorMessage(error));
    },
  });
}

export const useCreateTask = () =>
  useTaskMutation(tasksApi.create, { success: "Tarea creada" });

export const useUpdateTask = () =>
  useTaskMutation(({ id, data }) => tasksApi.update(id, data), {
    success: "Cambios guardados",
  });

export function useCompleteTask() {
  const openTask = useUiStore((state) => state.openTask);
  return useTaskMutation(({ id, score }) => tasksApi.complete(id, score), {
    onDone: (task, { score }) => {
      if (score != null) {
        toast.success("Tarea completada y calificada");
        return;
      }
      toast.success("Tarea completada", {
        action: {
          label: "Poner nota",
          onClick: () => openTask(task._id, { focus: "grade" }),
        },
      });
    },
  });
}

export const useReopenTask = () =>
  useTaskMutation((id) => tasksApi.reopen(id), { success: "Tarea reabierta" });

export function useDeleteTask() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: tasksApi.remove,
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: qk.tasks.detail(id) });
      invalidateAcademic(queryClient);
      toast.success("Tarea eliminada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { gradesApi } from "../services/api.js";
import { timeZone } from "../utils/dates.js";
import { getErrorMessage } from "../utils/errors.js";
import { invalidateAcademic, qk } from "./queryKeys.js";

export function useGradeStats() {
  return useQuery({
    queryKey: qk.grades.stats,
    queryFn: () => gradesApi.stats(timeZone()),
  });
}

export function useGradedTasks() {
  return useQuery({
    queryKey: qk.grades.list,
    queryFn: () => gradesApi.list(),
  });
}

export function useSetGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, score }) => gradesApi.set(taskId, score),
    onSuccess: (task) => {
      queryClient.setQueryData(qk.tasks.detail(task._id), task);
      invalidateAcademic(queryClient);
      toast.success("Nota guardada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useRemoveGrade() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (taskId) => gradesApi.remove(taskId),
    onSuccess: (task) => {
      queryClient.setQueryData(qk.tasks.detail(task._id), task);
      invalidateAcademic(queryClient);
      toast.success("Nota quitada");
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { subjectsApi } from '../services/api.js';
import { getErrorMessage } from '../utils/errors.js';
import { invalidateAcademic, qk } from './queryKeys.js';

// Las asignaturas viajan embebidas en el usuario: no hace falta otra petición.
export function useSubjects() {
  const { user } = useAuth();
  return useMemo(() => {
    const subjects = [...(user?.subjects ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'es'));
    const byId = new Map(subjects.map((subject) => [subject._id, subject]));
    return { subjects, byId, get: (id) => (id ? byId.get(id) ?? null : null) };
  }, [user?.subjects]);
}

function useSubjectMutation(mutationFn, apply, success) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (result, variables) => {
      queryClient.setQueryData(qk.me, (user) => (user ? { ...user, subjects: apply(user.subjects, result, variables) } : user));
      invalidateAcademic(queryClient);
      toast.success(success);
    },
    // Los errores de campo los gestiona el formulario.
    onError: (error) => {
      if (!error.fields) toast.error(getErrorMessage(error));
    },
  });
}

export const useCreateSubject = () =>
  useSubjectMutation(subjectsApi.create, (subjects, created) => [...subjects, created], 'Asignatura creada');

export const useUpdateSubject = () =>
  useSubjectMutation(
    ({ id, data }) => subjectsApi.update(id, data),
    (subjects, updated) => subjects.map((subject) => (subject._id === updated._id ? updated : subject)),
    'Asignatura actualizada',
  );

export const useDeleteSubject = () =>
  useSubjectMutation(subjectsApi.remove, (subjects, _result, id) => subjects.filter((subject) => subject._id !== id), 'Asignatura eliminada');

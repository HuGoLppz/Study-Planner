import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { toast } from 'sonner';
import { filesApi } from '../services/api.js';
import { getErrorMessage } from '../utils/errors.js';
import { qk } from './queryKeys.js';

export const MAX_FILE_MB = 10;
export const ACCEPTED_FILES = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.odp,.zip';

export function useRoomFiles(roomId) {
  return useQuery({ queryKey: qk.rooms.files(roomId), queryFn: () => filesApi.list(roomId), enabled: Boolean(roomId) });
}

export function useUploadRoomFile(roomId) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState(null);

  const mutation = useMutation({
    mutationFn: (file) => {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        return Promise.reject(new Error(`El archivo pesa más de ${MAX_FILE_MB} MB`));
      }
      setProgress(0);
      return filesApi.upload(roomId, file, setProgress);
    },
    onSuccess: (file) => {
      queryClient.setQueryData(qk.rooms.files(roomId), (files = []) => [file, ...files.filter((item) => item._id !== file._id)]);
      queryClient.invalidateQueries({ queryKey: qk.rooms.detail(roomId) });
      toast.success(`${file.originalName} subido`);
    },
    onError: (error) => toast.error(getErrorMessage(error, 'No se ha podido subir el archivo')),
    onSettled: () => setProgress(null),
  });

  return { ...mutation, progress };
}

export function useDeleteRoomFile(roomId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId) => filesApi.remove(roomId, fileId),
    onSuccess: (_data, fileId) => {
      queryClient.setQueryData(qk.rooms.files(roomId), (files = []) => files.filter((file) => file._id !== fileId));
      toast.success('Archivo eliminado');
    },
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

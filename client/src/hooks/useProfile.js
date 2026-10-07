import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext.jsx';
import { authApi, usersApi } from '../services/api.js';
import { getErrorMessage } from '../utils/errors.js';

function useUserMutation(mutationFn, success) {
  const { setUser } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: (user) => {
      if (user?._id) setUser(user);
      queryClient.invalidateQueries({ queryKey: ['profile'] });
      if (success) toast.success(success);
    },
    onError: (error) => {
      if (!error.fields) toast.error(getErrorMessage(error));
    },
  });
}

export const useUpdateProfile = () => useUserMutation(usersApi.updateMe, 'Perfil actualizado');
export const useUpdatePrivacy = () => useUserMutation(usersApi.updatePrivacy, 'Privacidad actualizada');
export const useUpdatePreferences = () => useUserMutation(usersApi.updatePreferences);
export const useUploadAvatar = () => useUserMutation(usersApi.uploadAvatar, 'Foto actualizada');
export const useRemoveAvatar = () => useUserMutation(usersApi.removeAvatar, 'Foto eliminada');
export const useChangePassword = () => useUserMutation(authApi.changePassword, 'Contraseña cambiada. Las demás sesiones se han cerrado.');

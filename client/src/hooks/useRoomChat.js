import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { messagesApi } from '../services/api.js';
import { connectSocket } from '../services/socket.js';
import { getErrorMessage } from '../utils/errors.js';
import { qk } from './queryKeys.js';

const TYPING_TIMEOUT = 3500;

// Historial paginado hacia atrás. pages[0] es la página más reciente.
export function useRoomMessages(roomId) {
  const query = useInfiniteQuery({
    queryKey: qk.rooms.messages(roomId),
    queryFn: ({ pageParam }) => messagesApi.list(roomId, pageParam),
    initialPageParam: null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: Boolean(roomId),
  });

  const messages = useMemo(
    () => (query.data ? [...query.data.pages].reverse().flatMap((page) => page.items) : []),
    [query.data],
  );
  return { ...query, messages };
}

function upsertMessage(data, message) {
  if (!data) return data;
  const exists = data.pages.some((page) => page.items.some((item) => item._id === message._id));
  if (exists) {
    return {
      ...data,
      pages: data.pages.map((page) => ({ ...page, items: page.items.map((item) => (item._id === message._id ? message : item)) })),
    };
  }
  const [newest, ...rest] = data.pages;
  return { ...data, pages: [{ ...newest, items: [...newest.items, message] }, ...rest] };
}

function dropMessage(data, messageId) {
  if (!data) return data;
  return { ...data, pages: data.pages.map((page) => ({ ...page, items: page.items.filter((item) => item._id !== messageId) })) };
}

export function useSendMessage(roomId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body) => messagesApi.send(roomId, body),
    onSuccess: (message) => queryClient.setQueryData(qk.rooms.messages(roomId), (data) => upsertMessage(data, message)),
    onError: (error) => toast.error(getErrorMessage(error, 'No se ha podido enviar el mensaje')),
  });
}

export function useEditMessage(roomId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, body }) => messagesApi.update(roomId, messageId, body),
    onSuccess: (message) => queryClient.setQueryData(qk.rooms.messages(roomId), (data) => upsertMessage(data, message)),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

export function useDeleteMessage(roomId) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (messageId) => messagesApi.remove(roomId, messageId),
    onSuccess: (_data, messageId) => queryClient.setQueryData(qk.rooms.messages(roomId), (data) => dropMessage(data, messageId)),
    onError: (error) => toast.error(getErrorMessage(error)),
  });
}

// Suscripción en tiempo real a una sala: mensajes, cambios de la sala, archivos y "escribiendo".
export function useRoomRealtime(roomId, currentUserId) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [typing, setTyping] = useState([]);
  const timers = useRef(new Map());

  useEffect(() => {
    if (!roomId) return undefined;
    const socket = connectSocket();
    const join = () => socket.emit('room:join', roomId);
    const messagesKey = qk.rooms.messages(roomId);

    const handlers = {
      'message:new': (message) => {
        if (message.room !== roomId) return;
        queryClient.setQueryData(messagesKey, (data) => upsertMessage(data, message));
        clearTyping(message.author?._id);
      },
      'message:updated': (message) => {
        if (message.room === roomId) queryClient.setQueryData(messagesKey, (data) => upsertMessage(data, message));
      },
      'message:deleted': ({ _id, room }) => {
        if (room === roomId) queryClient.setQueryData(messagesKey, (data) => dropMessage(data, _id));
      },
      'room:updated': (room) => {
        if (room._id !== roomId) return;
        queryClient.setQueryData(qk.rooms.detail(roomId), room);
        queryClient.invalidateQueries({ queryKey: qk.rooms.list });
      },
      'room:files': ({ roomId: changed }) => {
        if (changed === roomId) queryClient.invalidateQueries({ queryKey: qk.rooms.files(roomId) });
      },
      'room:deleted': ({ roomId: deleted }) => {
        if (deleted !== roomId) return;
        toast('Esta sala se ha eliminado');
        queryClient.invalidateQueries({ queryKey: qk.rooms.all });
        navigate('/salas', { replace: true });
      },
      'room:typing': ({ roomId: room, user }) => {
        if (room !== roomId || user._id === currentUserId) return;
        setTyping((list) => (list.some((item) => item._id === user._id) ? list : [...list, user]));
        clearTimeout(timers.current.get(user._id));
        timers.current.set(user._id, setTimeout(() => clearTyping(user._id), TYPING_TIMEOUT));
      },
    };

    function clearTyping(userId) {
      if (!userId) return;
      clearTimeout(timers.current.get(userId));
      timers.current.delete(userId);
      setTyping((list) => list.filter((item) => item._id !== userId));
    }

    // Al reconectar se vuelve a entrar en el canal y se recupera lo que se haya perdido.
    let joinedBefore = false;
    const onReconnect = () => {
      join();
      if (joinedBefore) {
        queryClient.invalidateQueries({ queryKey: messagesKey });
        queryClient.invalidateQueries({ queryKey: qk.rooms.detail(roomId) });
      }
      joinedBefore = true;
    };

    if (socket.connected) onReconnect();
    socket.on('connect', onReconnect);
    Object.entries(handlers).forEach(([event, handler]) => socket.on(event, handler));

    const pending = timers.current;
    return () => {
      socket.emit('room:leave', roomId);
      socket.off('connect', onReconnect);
      Object.entries(handlers).forEach(([event, handler]) => socket.off(event, handler));
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
      setTyping([]);
    };
  }, [roomId, currentUserId, queryClient, navigate]);

  const lastTypingEmit = useRef(0);
  const notifyTyping = () => {
    const now = Date.now();
    if (now - lastTypingEmit.current < 2000) return;
    lastTypingEmit.current = now;
    connectSocket().emit('room:typing', roomId);
  };

  return { typing, notifyTyping };
}

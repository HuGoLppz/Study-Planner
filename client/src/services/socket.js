import { io } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || undefined;

let socket = null;

// Una única conexión por pestaña, autenticada con la cookie de sesión.
export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, {
      withCredentials: true,
      autoConnect: false,
      // Solo WebSocket, como el servidor: así funciona igual con uno o varios procesos.
      transports: ["websocket"],
    });
  }
  return socket;
}

export function connectSocket() {
  const instance = getSocket();
  if (!instance.connected) instance.connect();
  return instance;
}

export function disconnectSocket() {
  socket?.disconnect();
}

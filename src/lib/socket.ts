import { io, Socket } from "socket.io-client";

export type SocketEventHandler = (payload: any) => void;

export let socket: Socket | null = null;

export const initRealtimeConnection = (token: string, userId: string) => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io("/", {
    auth: {
      token,
      userId,
    },
    transports: ["websocket"],
    path: "/socket.io",
  });

  socket.on("connect_error", (error) => {
    console.warn("Realtime connection failed:", error);
  });

  return socket;
};

export const joinRealtimeRooms = (rooms: string[]) => {
  if (!socket) return;
  rooms.forEach((room) => {
    if (room) {
      socket?.emit("joinRoom", { room });
    }
  });
};

export const leaveRealtimeRooms = (rooms: string[]) => {
  if (!socket) return;
  rooms.forEach((room) => {
    if (room) {
      socket?.emit("leaveRoom", { room });
    }
  });
};

export const emitTypingStatus = (payload: { targetType: string; targetId: string; userName: string; isTyping?: boolean }) => {
  if (!socket) return;
  const active = payload.isTyping !== false;
  socket.emit(active ? "typing:start" : "typing:stop", {
    targetType: payload.targetType,
    targetId: payload.targetId,
    userName: payload.userName,
  });
};

export const disconnectRealtime = () => {
  if (!socket) return;
  socket.disconnect();
  socket = null;
};

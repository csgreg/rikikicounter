import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// In production set REACT_APP_SOCKET_URL (e.g. on Vercel) to the public backend.
// Falls back to the local dev server when not provided.
const URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3031/";

export const socket: TypedSocket = io(URL, {
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 4000,
  timeout: 10000,
});

// Phones suspend JS (and kill the socket) while locked or backgrounded, and
// socket.io's retry timer is throttled with it. Kick the connection the moment
// the app is usable again instead of waiting for the next scheduled retry.
function wake() {
  if (!socket.connected) {
    socket.connect();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") wake();
  });
  window.addEventListener("focus", wake);
  window.addEventListener("online", wake);
  window.addEventListener("pageshow", wake);
}

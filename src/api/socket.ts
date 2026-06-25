import { io, Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types";

export type TypedSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// In production set REACT_APP_SOCKET_URL (e.g. on Vercel) to the public backend.
// Falls back to the local dev server when not provided.
const URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:3031/";

export const socket: TypedSocket = io(URL);

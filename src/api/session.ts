// Lightweight persistence so a refresh / accidental exit doesn't lose the game.
// The server keeps the authoritative room state, so we only need to remember
// which room we're in and a STABLE player id (socket.id changes on reconnect).

import type { GameMeta, Player } from "../types";
import {
  createSessionStore,
  type RoomSession,
  type RoomSnapshot,
} from "../shared/session";

const PID_KEY = "rikiki_pid";

export type Session = RoomSession;
export type Snapshot = RoomSnapshot<GameMeta, Player>;

// A stable per-browser player id that survives reconnects and refreshes.
export function getPid(): string {
  let pid = localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

const store = createSessionStore<GameMeta, Player>(
  "rikiki_session",
  "rikiki_snapshot"
);

export const hasSession = store.hasSession;
export const saveSession = store.saveSession;
export const loadSession = store.loadSession;
export const clearSession = store.clearSession;
export const saveSnapshot = store.saveSnapshot;
export const loadSnapshot = store.loadSnapshot;
export const clearSnapshot = store.clearSnapshot;

// Lightweight persistence so a refresh / accidental exit doesn't lose the game.
// The server keeps the authoritative room state, so we only need to remember
// which room we're in and a STABLE player id (socket.id changes on reconnect).

import type { GameMeta, Player } from "../types";

const PID_KEY = "rikiki_pid";
const SESSION_KEY = "rikiki_session";
const SNAPSHOT_KEY = "rikiki_snapshot";

export interface Session {
  roomId: string;
}

// Last known full room state, kept so a host can resurrect the game if the
// backend restarts (free tier) and the room disappears server-side.
export interface Snapshot {
  roomId: string;
  game: GameMeta;
  players: Player[];
}

// A stable per-browser player id that survives reconnects and refreshes.
export function getPid(): string {
  let pid = localStorage.getItem(PID_KEY);
  if (!pid) {
    pid = "p_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem(PID_KEY, pid);
  }
  return pid;
}

export function saveSession(roomId: string): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId }));
}

export function loadSession(): Session | null {
  try {
    return (JSON.parse(localStorage.getItem(SESSION_KEY) || "null") as Session) || null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY);
}

export function saveSnapshot(snap: Snapshot): void {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
}

export function loadSnapshot(): Snapshot | null {
  try {
    return (JSON.parse(localStorage.getItem(SNAPSHOT_KEY) || "null") as Snapshot) || null;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  localStorage.removeItem(SNAPSHOT_KEY);
}

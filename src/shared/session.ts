// Generic localStorage-backed room session + snapshot persistence, shared by
// every game. Each game binds this to its own literal storage keys and types
// via createSessionStore — literal, not derived, so existing players' saved
// sessions keep working unchanged across this extraction.

export interface RoomSession {
  roomId: string;
}

// Last known full room state, kept so a host can resurrect the game if the
// backend restarts (free tier) and the room disappears server-side.
export interface RoomSnapshot<TGame, TPlayer> {
  roomId: string;
  game: TGame;
  players: TPlayer[];
}

export interface SessionStore<TGame, TPlayer> {
  hasSession(): boolean;
  saveSession(roomId: string): void;
  loadSession(): RoomSession | null;
  clearSession(): void;
  saveSnapshot(snap: RoomSnapshot<TGame, TPlayer>): void;
  loadSnapshot(): RoomSnapshot<TGame, TPlayer> | null;
  clearSnapshot(): void;
}

export function createSessionStore<TGame, TPlayer>(
  sessionKey: string,
  snapshotKey: string
): SessionStore<TGame, TPlayer> {
  return {
    hasSession() {
      return !!localStorage.getItem(sessionKey);
    },
    saveSession(roomId) {
      localStorage.setItem(sessionKey, JSON.stringify({ roomId }));
    },
    loadSession() {
      try {
        return (
          (JSON.parse(localStorage.getItem(sessionKey) || "null") as RoomSession) ||
          null
        );
      } catch {
        return null;
      }
    },
    clearSession() {
      localStorage.removeItem(sessionKey);
    },
    saveSnapshot(snap) {
      localStorage.setItem(snapshotKey, JSON.stringify(snap));
    },
    loadSnapshot() {
      try {
        return (
          (JSON.parse(localStorage.getItem(snapshotKey) || "null") as RoomSnapshot<
            TGame,
            TPlayer
          >) || null
        );
      } catch {
        return null;
      }
    },
    clearSnapshot() {
      localStorage.removeItem(snapshotKey);
    },
  };
}

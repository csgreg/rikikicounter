import { createContext, useContext, type ReactNode } from "react";
import { socket, type TypedSocket } from "../api/socket";
import { getPid, type Snapshot } from "../api/session";
import { buildStatePayload } from "../api/state";
import { useRoomConnection } from "../shared/useRoomConnection";
import type { GameMeta, Player } from "../types";

interface GameContextValue {
  socket: TypedSocket;
  roomId: string;
  setRoomId: (s: string) => void;
  game: GameMeta;
  setGame: (g: GameMeta) => void;
  players: Player[];
  setPlayers: (p: Player[]) => void;
  currentPlayerNum: number;
  me: Player | null;
  isBoss: boolean;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  resetKicked: () => void;
  recover: Snapshot | null;
  recoverGame: () => void;
  dismissRecover: () => void;
  cancelRestore: () => void;
  leave: () => void;
}

const EMPTY_GAME: GameMeta = {
  laps: 0,
  players: 0,
  gameStarted: false,
  game: false,
  finished: false,
};

const GameContext = createContext<GameContextValue | null>(null);

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) {
    throw new Error("useGame must be used within a GameProvider");
  }
  return ctx;
}

export function GameProvider({ children }: { children: ReactNode }) {
  const {
    roomId,
    setRoomId,
    game,
    setGame,
    players,
    setPlayers,
    connected,
    restoring,
    kicked,
    resetKicked,
    recover,
    dismissRecover,
    cancelRestore,
    leave,
    sessionStore,
  } = useRoomConnection<GameMeta, Player>({
    sessionKey: "rikiki_session",
    snapshotKey: "rikiki_snapshot",
    emptyGame: EMPTY_GAME,
  });

  const pid = getPid();
  const currentPlayerNum = players.findIndex((p) => p.pid === pid);
  const me = currentPlayerNum >= 0 ? players[currentPlayerNum] ?? null : null;
  const isBoss = !!(me && me.boss);

  // Host resurrects the game from the local snapshot in a brand-new room,
  // carrying over scores/round; everyone else rejoins with the new code.
  function recoverGame() {
    if (!recover) return;
    const snap = recover;
    socket.emit("create-room", 6, (resp) => {
      const newRoomId = resp.roomId;
      const players = snap.players.map((p) => ({
        ...p,
        online: p.pid === pid,
        socketid: p.pid === pid ? socket.id : "",
      }));
      const game = { ...snap.game };
      sessionStore.saveSession(newRoomId);
      sessionStore.saveSnapshot({ roomId: newRoomId, game, players });
      const target = game.game ? "/game" : "/wait";
      socket.emit(
        "sync-state",
        newRoomId,
        buildStatePayload(game, players),
        false,
        () => window.location.assign(target)
      );
    });
  }

  const value: GameContextValue = {
    socket,
    roomId,
    setRoomId,
    game,
    setGame,
    players,
    setPlayers,
    currentPlayerNum,
    me,
    isBoss,
    connected,
    restoring,
    kicked,
    resetKicked,
    recover,
    recoverGame,
    dismissRecover,
    cancelRestore,
    leave,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

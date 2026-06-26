import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { socket, type TypedSocket } from "../api/socket";
import { clearSession, getPid, loadSession } from "../api/session";
import { parseBroadcastState, parseFetchedState, syncState } from "../api/state";
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
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState<GameMeta>(EMPTY_GAME);
  const [players, setPlayers] = useState<Player[]>([]);
  const [currentPlayerNum, setCurrentPlayerNum] = useState(-1);
  const [restoring, setRestoring] = useState<boolean>(() => !!loadSession());
  const [connected, setConnected] = useState(socket.connected);
  const [kicked, setKicked] = useState(false);

  // Track the live socket connection (false during cold starts / drops).
  useEffect(() => {
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
    };
  }, []);

  // Keep the room state in sync with the server.
  useEffect(() => {
    function onStateChanged(args: { roomId: string; state: string }) {
      if (args.roomId !== roomId) return;
      const state = parseBroadcastState(args.state);
      const pid = getPid();
      const myIdx = state.players.findIndex((p) => p.pid === pid);

      // We had a seat but it's gone now -> the host kicked us.
      if (myIdx === -1 && loadSession()) {
        clearSession();
        setKicked(true);
        return;
      }

      setGame(state.game);
      setPlayers(state.players);
      // Always recompute by pid: indices shift when players are removed.
      setCurrentPlayerNum(myIdx);
    }

    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
  }, [roomId]);

  // On load / refresh: if we have a saved session, rejoin and restore.
  useEffect(() => {
    const session = loadSession();
    if (!session || !session.roomId) {
      setRestoring(false);
      return;
    }
    const pid = getPid();
    const savedRoomId = session.roomId;

    function restore() {
      socket.emit("join-room", savedRoomId, (res) => {
        if (!res || res.status !== "ok") {
          clearSession();
          setRestoring(false);
          return;
        }
        setRoomId(savedRoomId);

        socket.emit("get-state", savedRoomId, (stateRes) => {
          try {
            if (!stateRes.state) throw new Error("missing state");
            const obj = parseFetchedState(stateRes.state);
            const idx = obj.players.findIndex((p) => p.pid === pid);
            if (idx === -1) {
              // Our seat is gone (kicked while we were away).
              clearSession();
              setKicked(true);
              setRestoring(false);
              return;
            }
            // Our socket.id changed on reconnect — update it + mark online.
            obj.players[idx].socketid = socket.id;
            obj.players[idx].online = true;
            setCurrentPlayerNum(idx);
            setGame(obj.game);
            setPlayers(obj.players);
            syncState(socket, savedRoomId, obj.game, obj.players);
          } catch {
            clearSession();
          }
          setRestoring(false);
        });
      });
    }

    if (socket.connected) {
      restore();
    } else {
      socket.once("connect", restore);
    }
    return () => {
      socket.off("connect", restore);
    };
  }, []);

  const me = currentPlayerNum >= 0 ? players[currentPlayerNum] ?? null : null;
  const isBoss = !!(me && me.boss);

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
    resetKicked: () => setKicked(false),
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

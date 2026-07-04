import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { socket, type TypedSocket } from "../api/socket";
import {
  clearSession,
  clearSnapshot,
  getPid,
  loadSession,
  loadSnapshot,
  saveSession,
  saveSnapshot,
  type Snapshot,
} from "../api/session";
import {
  buildStatePayload,
  parseBroadcastState,
  parseFetchedState,
  syncState,
} from "../api/state";
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
  const [recover, setRecover] = useState<Snapshot | null>(null);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;

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
        clearSnapshot();
        setKicked(true);
        return;
      }

      setGame(state.game);
      setPlayers(state.players);
      // Always recompute by pid: indices shift when players are removed.
      setCurrentPlayerNum(myIdx);
      // Keep a local snapshot for backend-restart recovery.
      saveSnapshot({ roomId, game: state.game, players: state.players });
    }

    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
  }, [roomId]);

  // Join the room + pull fresh state. Runs on first load (session restore),
  // after EVERY reconnect (the server forgets socket.io room membership on
  // disconnect, so broadcasts stop arriving and our state goes stale — typical
  // after the phone was locked mid-game), and when the tab wakes up. Attached
  // to every "connect" rather than `once` so a response lost to a connection
  // flap self-heals on the next connect instead of hanging the app.
  useEffect(() => {
    function resync() {
      const id = roomIdRef.current || loadSession()?.roomId || "";
      if (!id) {
        setRestoring(false);
        return;
      }
      const pid = getPid();
      socket.emit("join-room", id, (res) => {
        if (!res || res.status !== "ok") {
          // Room is gone server-side (e.g. the backend restarted). If we have
          // a snapshot of this room, offer to resurrect it instead of bailing.
          const snap = loadSnapshot();
          if (
            snap &&
            snap.roomId === id &&
            snap.players.some((p) => p.pid === pid)
          ) {
            setRecover(snap);
          } else {
            clearSession();
            clearSnapshot();
          }
          setRestoring(false);
          return;
        }
        socket.emit("get-state", id, (stateRes) => {
          try {
            if (!stateRes.state) throw new Error("missing state");
            const obj = parseFetchedState(stateRes.state);
            const idx = obj.players.findIndex((p) => p.pid === pid);
            if (idx === -1) {
              // Our seat is gone (kicked while we were away).
              clearSession();
              clearSnapshot();
              setKicked(true);
              setRestoring(false);
              return;
            }
            // Our socket.id changed on reconnect — update it + mark online.
            obj.players[idx].socketid = socket.id;
            obj.players[idx].online = true;
            setRoomId(id);
            setCurrentPlayerNum(idx);
            setGame(obj.game);
            setPlayers(obj.players);
            saveSnapshot({ roomId: id, game: obj.game, players: obj.players });
            syncState(socket, id, obj.game, obj.players);
          } catch {
            clearSession();
          }
          setRestoring(false);
        });
      });
    }

    const onVisible = () => {
      // If we're disconnected, socket.ts already kicks a reconnect on wake
      // and the resulting "connect" event triggers resync.
      if (document.visibilityState === "visible" && socket.connected) resync();
    };

    socket.on("connect", resync);
    document.addEventListener("visibilitychange", onVisible);
    if (socket.connected) resync();
    return () => {
      socket.off("connect", resync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const me = currentPlayerNum >= 0 ? players[currentPlayerNum] ?? null : null;
  const isBoss = !!(me && me.boss);

  // Host resurrects the game from the local snapshot in a brand-new room,
  // carrying over scores/round; everyone else rejoins with the new code.
  function recoverGame() {
    if (!recover) return;
    const snap = recover;
    const pid = getPid();
    socket.emit("create-room", 6, (resp) => {
      const newRoomId = resp.roomId;
      const players = snap.players.map((p) => ({
        ...p,
        online: p.pid === pid,
        socketid: p.pid === pid ? socket.id : "",
      }));
      const game = { ...snap.game };
      saveSession(newRoomId);
      saveSnapshot({ roomId: newRoomId, game, players });
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

  function dismissRecover() {
    clearSession();
    clearSnapshot();
    setRoomId("");
    setRecover(null);
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
    resetKicked: () => setKicked(false),
    recover,
    recoverGame,
    dismissRecover,
  };

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

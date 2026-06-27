import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import type { MGame, MPlayer, MRoom } from "./types";

const MAFIA_SESSION_KEY = "rikiki_mafia_room";

const EMPTY_GAME: MGame = {
  phase: "lobby",
  time: "night",
  round: 1,
  config: { mafia: 1, detective: true, doctor: true },
  started: false,
  winner: null,
};

interface MafiaContextValue {
  roomId: string;
  setRoomId: (s: string) => void;
  game: MGame;
  setGame: (g: MGame) => void;
  players: MPlayer[];
  setPlayers: (p: MPlayer[]) => void;
  me: MPlayer | null;
  isHost: boolean;
  connected: boolean;
  restoring: boolean;
  /** Push state to the server. Pass an explicit room id to avoid stale closures. */
  push: (game: MGame, players: MPlayer[], roomIdOverride?: string) => void;
  leave: () => void;
}

const MafiaContext = createContext<MafiaContextValue | null>(null);

export function useMafia(): MafiaContextValue {
  const ctx = useContext(MafiaContext);
  if (!ctx) throw new Error("useMafia must be used within a MafiaProvider");
  return ctx;
}

function payload(game: MGame, players: MPlayer[]): string {
  return `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(
    players
  )} }`;
}

export function MafiaProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState<MGame>(EMPTY_GAME);
  const [players, setPlayers] = useState<MPlayer[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [restoring, setRestoring] = useState<boolean>(
    () => !!localStorage.getItem(MAFIA_SESSION_KEY)
  );

  // connection tracking
  useEffect(() => {
    const onC = () => setConnected(true);
    const onD = () => setConnected(false);
    socket.on("connect", onC);
    socket.on("disconnect", onD);
    setConnected(socket.connected);
    return () => {
      socket.off("connect", onC);
      socket.off("disconnect", onD);
    };
  }, []);

  // state sync
  useEffect(() => {
    function onStateChanged(args: { roomId: string; state: string }) {
      if (args.roomId !== roomId) return;
      const state = JSON.parse(args.state) as MRoom;
      setGame(state.game);
      setPlayers(state.players);
    }
    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
  }, [roomId]);

  // restore on load / refresh
  useEffect(() => {
    const saved = localStorage.getItem(MAFIA_SESSION_KEY);
    if (!saved) {
      setRestoring(false);
      return;
    }
    const pid = getPid();

    const restore = () => {
      socket.emit("join-room", saved, (res) => {
        if (!res || res.status !== "ok") {
          localStorage.removeItem(MAFIA_SESSION_KEY);
          setRestoring(false);
          return;
        }
        setRoomId(saved);
        socket.emit("get-state", saved, (stateRes) => {
          try {
            if (!stateRes.state) throw new Error("no state");
            const obj = JSON.parse(JSON.parse(stateRes.state)) as MRoom;
            const idx = obj.players.findIndex((p) => p.pid === pid);
            if (idx === -1) {
              localStorage.removeItem(MAFIA_SESSION_KEY);
              setRestoring(false);
              return;
            }
            obj.players[idx].socketid = socket.id;
            obj.players[idx].online = true;
            setGame(obj.game);
            setPlayers(obj.players);
            socket.emit("sync-state", saved, payload(obj.game, obj.players), false, () => {});
          } catch {
            localStorage.removeItem(MAFIA_SESSION_KEY);
          }
          setRestoring(false);
        });
      });
    };

    if (socket.connected) restore();
    else socket.once("connect", restore);
    return () => {
      socket.off("connect", restore);
    };
  }, []);

  const me = players.find((p) => p.pid === getPid()) ?? null;
  const isHost = !!(me && me.boss);

  function push(g: MGame, p: MPlayer[], roomIdOverride?: string) {
    const id = roomIdOverride || roomId;
    if (!id) return;
    socket.emit("sync-state", id, payload(g, p), false, () => {});
  }

  function leave() {
    localStorage.removeItem(MAFIA_SESSION_KEY);
    setRoomId("");
    setGame(EMPTY_GAME);
    setPlayers([]);
  }

  const value: MafiaContextValue = {
    roomId,
    setRoomId,
    game,
    setGame,
    players,
    setPlayers,
    me,
    isHost,
    connected,
    restoring,
    push,
    leave,
  };

  return <MafiaContext.Provider value={value}>{children}</MafiaContext.Provider>;
}

export { MAFIA_SESSION_KEY, EMPTY_GAME };

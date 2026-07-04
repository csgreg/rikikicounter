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
import type { GameMeta, Player, RoomState } from "../types";

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
  const restoringRef = useRef(restoring);
  restoringRef.current = restoring;

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

  // Keep the room state in sync with the server. Broadcasts are matched
  // against the saved session too, not just the roomId state — right after
  // joining, the first echo can arrive before React re-rendered with the new
  // roomId, and dropping it would lose the initial snapshot.
  useEffect(() => {
    function onStateChanged(args: { roomId: string; state: string }) {
      if (args.roomId !== roomId && args.roomId !== loadSession()?.roomId) {
        return;
      }
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
      saveSnapshot({
        roomId: args.roomId,
        game: state.game,
        players: state.players,
      });
    }

    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
  }, [roomId]);

  // Join the room + pull fresh state. Runs on first load (session restore),
  // after EVERY reconnect (the server forgets socket.io room membership on
  // disconnect, so broadcasts stop arriving and our state goes stale — typical
  // after the phone was locked mid-game), and when the tab wakes up.
  //
  // Deliberately paranoid: it never clears the session on what may be a
  // transient failure (cold-starting free-tier backend, lost ack), it retries
  // with a timer until it succeeds, and it only READS state — pushing is
  // reserved for the initial restore, so several flaky phones reconnecting
  // can't clobber each other's live state. If the room record is gone
  // server-side it first tries to resurrect it IN PLACE from the local
  // snapshot (same room code for everyone); the recovery screen is the last
  // resort, not the first reaction.
  useEffect(() => {
    let disposed = false;
    let inFlightSince = 0;
    let failCount = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function scheduleRetry(ms: number) {
      if (disposed) return;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        resync();
      }, ms);
    }

    function settle() {
      inFlightSince = 0;
      setRestoring(false);
    }

    function adoptState(id: string, obj: RoomState, push: boolean) {
      const pid = getPid();
      const idx = obj.players.findIndex((p) => p.pid === pid);
      if (idx === -1) {
        // Our seat is gone (kicked while we were away).
        clearSession();
        clearSnapshot();
        setKicked(true);
        settle();
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
      if (push) syncState(socket, id, obj.game, obj.players);
      failCount = 0;
      setRecover(null); // the room is back — retract a pending recovery offer
      settle();
    }

    function resync() {
      if (disposed) return;
      const id = roomIdRef.current || loadSession()?.roomId || "";
      if (!id) {
        settle();
        return;
      }
      // A disconnected socket can't resync; "connect" will re-trigger us.
      if (!socket.connected) return;
      // One resync at a time; a lost ack unblocks after a timeout (and any
      // disconnect resets it, since pending acks died with the connection).
      const now = Date.now();
      if (inFlightSince && now - inFlightSince < 8000) return;
      inFlightSince = now;
      const firstRestore = restoringRef.current;
      const pid = getPid();

      socket.emit("join-room", id, (res) => {
        if (disposed) return;
        if (!res || res.status !== "ok") {
          const snap = loadSnapshot();
          if (
            snap &&
            snap.roomId === id &&
            snap.players.some((p) => p.pid === pid)
          ) {
            // join-room failed. Probe with get-state first: if the room still
            // EXISTS (join refused for another reason, e.g. capacity), adopt
            // its live state read-only and retry joining later — never
            // overwrite a live room with our snapshot.
            socket.emit("get-state", id, (probe) => {
              if (disposed) return;
              try {
                if (!probe.state) throw new Error("room gone");
                const live = parseFetchedState(probe.state);
                adoptState(id, live, false);
                scheduleRetry(3000); // keep trying to re-join for broadcasts
                return;
              } catch {
                // Room record is truly gone server-side (backend restart
                // while we were away). Resurrect it under the SAME id from
                // the snapshot, so every player's saved session stays valid.
              }
              socket.emit(
                "sync-state",
                id,
                buildStatePayload(snap.game, snap.players),
                false,
                () => {
                  socket.emit("join-room", id, (res2) => {
                    if (disposed) return;
                    if (res2 && res2.status === "ok") {
                      adoptState(
                        id,
                        {
                          game: { ...snap.game },
                          players: snap.players.map((p) => ({ ...p })),
                        },
                        true
                      );
                    } else {
                      // Backend refuses the old id — fall back to the recovery
                      // screen, but only once this looks persistent.
                      failCount += 1;
                      if (failCount >= 3) {
                        setRecover(snap);
                        settle();
                      } else {
                        inFlightSince = 0;
                        scheduleRetry(Math.min(15000, 3000 * failCount));
                        if (!firstRestore) setRestoring(false);
                      }
                    }
                  });
                }
              );
            });
          } else {
            // No snapshot to fall back on. Never nuke the session over what
            // may be a transient error (a cold-starting backend takes ~30s+
            // and a connection flap burns failures within seconds) — keep the
            // session and retry with growing delays; after enough failures
            // just stop blocking the UI and let later connects try again.
            failCount += 1;
            inFlightSince = 0;
            if (failCount >= 5) {
              settle();
            } else {
              scheduleRetry(Math.min(15000, 3000 * failCount));
              if (!firstRestore) setRestoring(false);
            }
          }
          return;
        }
        socket.emit("get-state", id, (stateRes) => {
          if (disposed) return;
          try {
            if (!stateRes.state) throw new Error("missing state");
            adoptState(id, parseFetchedState(stateRes.state), firstRestore);
          } catch {
            // Empty/corrupt state (backend mid-boot?) — keep the session and
            // the last known UI, try again shortly.
            failCount += 1;
            inFlightSince = 0;
            if (failCount < 5) scheduleRetry(3000);
            else settle();
          }
        });
      });
    }

    const onDisconnect = () => {
      inFlightSince = 0;
    };
    const onVisible = () => {
      // If we're disconnected, socket.ts already kicks a reconnect on wake
      // and the resulting "connect" event triggers resync.
      if (document.visibilityState === "visible" && socket.connected) resync();
    };

    socket.on("connect", resync);
    socket.on("disconnect", onDisconnect);
    document.addEventListener("visibilitychange", onVisible);
    if (socket.connected) resync();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socket.off("connect", resync);
      socket.off("disconnect", onDisconnect);
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

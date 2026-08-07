import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import { useRoomConnection } from "../shared/useRoomConnection";
import type { RoomSnapshot } from "../shared/session";
import { buildStatePayload } from "../shared/state";
import { assignRoles } from "./roles";
import type {
  PresidentAction,
  PresidentGame,
  PresidentPlayer,
  PresidentRoom,
  PresidentRoundResult,
} from "./types";

const PRESIDENT_SESSION_KEY = "rikiki_president_room";
const PRESIDENT_SNAPSHOT_KEY = "rikiki_president_snapshot";

const EMPTY_GAME: PresidentGame = {
  started: false,
  finished: false,
  round: 1,
  roundOrder: [],
  history: [],
};

type PresidentSnapshot = RoomSnapshot<PresidentGame, PresidentPlayer>;

interface PresidentContextValue {
  roomId: string;
  setRoomId: (s: string) => void;
  game: PresidentGame;
  setGame: (g: PresidentGame) => void;
  players: PresidentPlayer[];
  setPlayers: (p: PresidentPlayer[]) => void;
  me: PresidentPlayer | null;
  isHost: boolean;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  recover: PresidentSnapshot | null;
  recoverGame: () => void;
  dismissRecover: () => void;
  cancelRestore: () => void;
  saveSession: (roomId: string) => void;
  syncExplicit: (roomId: string, game: PresidentGame, players: PresidentPlayer[]) => void;
  markFinished: () => void;
  hostStart: () => void;
  hostRestart: () => void;
  hostResetRound: () => void;
  hostFinishGame: () => void;
  kick: (pid: string) => void;
  hostEditPlayer: (pid: string, name: string, score?: number) => void;
  leave: () => void;
}

const PresidentContext = createContext<PresidentContextValue | null>(null);

export function usePresident(): PresidentContextValue {
  const ctx = useContext(PresidentContext);
  if (!ctx) throw new Error("usePresident must be used within a PresidentProvider");
  return ctx;
}

export function PresidentProvider({ children }: { children: ReactNode }) {
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
    recover,
    dismissRecover,
    cancelRestore,
    leave,
    sessionStore,
  } = useRoomConnection<PresidentGame, PresidentPlayer>({
    sessionKey: PRESIDENT_SESSION_KEY,
    snapshotKey: PRESIDENT_SNAPSHOT_KEY,
    emptyGame: EMPTY_GAME,
  });

  const roomIdRef = useRef(roomId);
  const gameRef = useRef(game);
  const rosterRef = useRef<PresidentPlayer[]>(players);
  const isHostRef = useRef(false);

  function syncNow(g: PresidentGame, p: PresidentPlayer[]) {
    if (!roomIdRef.current) return;
    socket.emit("sync-state", roomIdRef.current, buildStatePayload(g, p), false, () => {});
  }

  function snap(g: PresidentGame, p: PresidentPlayer[]) {
    if (roomIdRef.current) {
      sessionStore.saveSnapshot({ roomId: roomIdRef.current, game: g, players: p });
    }
  }

  // ----- host-only state transitions -----
  function applyAndSync(g: PresidentGame, p: PresidentPlayer[]) {
    gameRef.current = g;
    rosterRef.current = p;
    setGame(g);
    setPlayers(p);
    snap(g, p);
    syncNow(g, p);
  }

  function hostStart() {
    const ps = rosterRef.current.map((p) => ({ ...p, score: 0 }));
    applyAndSync(
      { started: true, finished: false, round: 1, roundOrder: [], history: [] },
      ps
    );
  }

  function hostRestart() {
    hostStart();
  }

  function hostFinishGame() {
    applyAndSync({ ...gameRef.current, finished: true }, rosterRef.current);
  }

  function kick(pid: string) {
    const remaining = rosterRef.current.filter((p) => p.pid !== pid);
    applyAndSync(gameRef.current, remaining);
  }

  function hostEditPlayer(pid: string, name: string, score?: number) {
    const ps = rosterRef.current.map((p) =>
      p.pid === pid
        ? { ...p, name, score: score === undefined ? p.score : score }
        : p
    );
    applyAndSync(gameRef.current, ps);
  }

  // Undo affordance for a mis-tap: clears everyone's "gone out" mark for the
  // round in progress without touching scores or past rounds.
  function hostResetRound() {
    const g = gameRef.current;
    if (!g.started || g.finished) return;
    applyAndSync({ ...g, roundOrder: [] }, rosterRef.current);
  }

  // The single place that ever mutates roundOrder/score/history — mirrors
  // Set's hostApplyClaim: called identically whether the finisher is the
  // host (direct call) or a guest (via the action-sent effect below), so
  // the host processes every "I'm out" in the order it actually receives
  // them, regardless of who sent it.
  function hostApplyFinish(pid: string) {
    const g = gameRef.current;
    if (!g.started || g.finished) return;
    if (g.roundOrder.includes(pid)) return; // already marked, stale tap -> no-op

    const roster = rosterRef.current;
    if (!roster.find((p) => p.pid === pid)) return;

    const order = [...g.roundOrder, pid];
    const stillPlaying = roster.filter((p) => !order.includes(p.pid));

    // Once a single player is left holding cards, they're automatically the
    // Trou — no tap needed from them.
    if (stillPlaying.length === 1) {
      order.push(stillPlaying[0].pid);
    }

    if (order.length < roster.length) {
      applyAndSync({ ...g, roundOrder: order }, roster);
      return;
    }

    const entries = assignRoles(order);
    const ps = roster.map((p) => {
      const entry = entries.find((e) => e.pid === p.pid);
      return entry ? { ...p, score: p.score + entry.points } : p;
    });
    const result: PresidentRoundResult = { round: g.round, entries };
    applyAndSync(
      { ...g, round: g.round + 1, roundOrder: [], history: [result, ...g.history] },
      ps
    );
  }

  function markFinished() {
    const pid = getPid();
    if (isHostRef.current) {
      hostApplyFinish(pid);
    } else {
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "finish", pid } as PresidentAction),
        false,
        () => {}
      );
    }
  }

  function syncExplicit(id: string, g: PresidentGame, p: PresidentPlayer[]) {
    sessionStore.saveSnapshot({ roomId: id, game: g, players: p });
    socket.emit("sync-state", id, buildStatePayload(g, p), false, () => {});
  }

  // ----- host applies client actions (single writer => no clobber) -----
  useEffect(() => {
    function onAction(args: { roomId: string; action: string }) {
      if (args.roomId !== roomIdRef.current || !isHostRef.current) return;
      let action: PresidentAction;
      try {
        action = JSON.parse(args.action);
      } catch {
        return;
      }
      if (action.type === "finish") hostApplyFinish(action.pid);
    }
    socket.on("action-sent", onAction);
    return () => {
      socket.off("action-sent", onAction);
    };
    // handlers read everything from refs; intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = players.find((p) => p.pid === getPid()) ?? null;
  const isHost = !!(me && me.boss);

  roomIdRef.current = roomId;
  gameRef.current = game;
  rosterRef.current = players;
  isHostRef.current = isHost;

  // Host resurrects the game from the local snapshot in a brand-new room,
  // carrying over scores/round/history; everyone else rejoins with the new
  // code.
  function recoverGame() {
    if (!recover) return;
    const snapshot = recover;
    const pid = getPid();
    socket.emit("create-room", 8, (resp) => {
      const newRoomId = resp.roomId;
      const players = snapshot.players.map((p) => ({
        ...p,
        online: p.pid === pid,
        socketid: p.pid === pid ? socket.id : "",
      }));
      const game = { ...snapshot.game };
      sessionStore.saveSession(newRoomId);
      sessionStore.saveSnapshot({ roomId: newRoomId, game, players });
      socket.emit("sync-state", newRoomId, buildStatePayload(game, players), false, () =>
        window.location.assign("/president/board")
      );
    });
  }

  const value: PresidentContextValue = {
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
    kicked,
    recover,
    recoverGame,
    dismissRecover,
    cancelRestore,
    saveSession: sessionStore.saveSession,
    syncExplicit,
    markFinished,
    hostStart,
    hostRestart,
    hostResetRound,
    hostFinishGame,
    kick,
    hostEditPlayer,
    leave,
  };

  return <PresidentContext.Provider value={value}>{children}</PresidentContext.Provider>;
}

export { EMPTY_GAME };
export type { PresidentRoom };

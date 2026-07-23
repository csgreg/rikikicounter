import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import { useRoomConnection } from "../shared/useRoomConnection";
import type { RoomSnapshot } from "../shared/session";
import { buildStatePayload } from "../shared/state";
import { dealInitial, hasAnySet, isSet, topUpBoard } from "./deck";
import type { SCard, SetAction, SetGame, SetPlayer, SetRoom } from "./types";

const SET_SESSION_KEY = "rikiki_set_room";
const SET_SNAPSHOT_KEY = "rikiki_set_snapshot";

const EMPTY_GAME: SetGame = {
  started: false,
  finished: false,
  board: [],
  deck: [],
  lastClaim: null,
};

type SetSnapshot = RoomSnapshot<SetGame, SetPlayer>;

interface SetContextValue {
  roomId: string;
  setRoomId: (s: string) => void;
  game: SetGame;
  setGame: (g: SetGame) => void;
  players: SetPlayer[];
  setPlayers: (p: SetPlayer[]) => void;
  me: SetPlayer | null;
  isHost: boolean;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  recover: SetSnapshot | null;
  recoverGame: () => void;
  dismissRecover: () => void;
  cancelRestore: () => void;
  saveSession: (roomId: string) => void;
  syncExplicit: (roomId: string, game: SetGame, players: SetPlayer[]) => void;
  claimSet: (cardIds: [string, string, string]) => void;
  hostStart: () => void;
  hostRestart: () => void;
  kick: (pid: string) => void;
  hostEditPlayer: (pid: string, name: string, score?: number) => void;
  leave: () => void;
}

const SetContext = createContext<SetContextValue | null>(null);

export function useSet(): SetContextValue {
  const ctx = useContext(SetContext);
  if (!ctx) throw new Error("useSet must be used within a SetProvider");
  return ctx;
}

export function SetProvider({ children }: { children: ReactNode }) {
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
  } = useRoomConnection<SetGame, SetPlayer>({
    sessionKey: SET_SESSION_KEY,
    snapshotKey: SET_SNAPSHOT_KEY,
    emptyGame: EMPTY_GAME,
  });

  const roomIdRef = useRef(roomId);
  const gameRef = useRef(game);
  const rosterRef = useRef<SetPlayer[]>(players);
  const isHostRef = useRef(false);

  function syncNow(g: SetGame, p: SetPlayer[]) {
    if (!roomIdRef.current) return;
    socket.emit("sync-state", roomIdRef.current, buildStatePayload(g, p), false, () => {});
  }

  function snap(g: SetGame, p: SetPlayer[]) {
    if (roomIdRef.current) {
      sessionStore.saveSnapshot({ roomId: roomIdRef.current, game: g, players: p });
    }
  }

  // ----- host-only state transitions -----
  function applyAndSync(g: SetGame, p: SetPlayer[]) {
    gameRef.current = g;
    rosterRef.current = p;
    setGame(g);
    setPlayers(p);
    snap(g, p);
    syncNow(g, p);
  }

  function hostStart() {
    const { board, deck } = dealInitial();
    const ps = rosterRef.current.map((p) => ({ ...p, score: 0 }));
    applyAndSync(
      { started: true, finished: false, board, deck, lastClaim: null },
      ps
    );
  }

  function hostRestart() {
    hostStart();
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

  // The single place that ever mutates the board/deck/scores. Called
  // identically whether the claimant is the host (direct call from
  // claimSet) or a guest (via the action-sent effect below) — exact mirror
  // of Wave's hostApplyGuess, which is what makes concurrent claims
  // race-safe: the host processes them serially in receipt order.
  function hostApplyClaim(pid: string, cardIds: [string, string, string]) {
    const g = gameRef.current;
    if (!g.started || g.finished) return;

    const picked = cardIds.map((id) => g.board.find((c) => c.id === id));
    if (picked.some((c) => !c)) return; // stale claim (already consumed) -> silent no-op

    const [a, b, c] = picked as [SCard, SCard, SCard];
    let ps = rosterRef.current;

    if (!isSet(a, b, c)) {
      ps = ps.map((p) =>
        p.pid === pid ? { ...p, score: Math.max(0, p.score - 1) } : p
      );
      applyAndSync({ ...g, lastClaim: { pid, ok: false, cardIds } }, ps);
      return;
    }

    const remaining = g.board.filter((card) => !cardIds.includes(card.id));
    const { board, deck } = topUpBoard(remaining, g.deck);
    ps = ps.map((p) => (p.pid === pid ? { ...p, score: p.score + 1 } : p));
    const finished = deck.length === 0 && !hasAnySet(board);
    applyAndSync(
      { ...g, board, deck, finished, lastClaim: { pid, ok: true, cardIds } },
      ps
    );
  }

  function claimSet(cardIds: [string, string, string]) {
    const pid = getPid();
    if (isHostRef.current) {
      hostApplyClaim(pid, cardIds);
    } else {
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "claim", pid, cardIds } as SetAction),
        false,
        () => {}
      );
    }
  }

  function syncExplicit(id: string, g: SetGame, p: SetPlayer[]) {
    sessionStore.saveSnapshot({ roomId: id, game: g, players: p });
    socket.emit("sync-state", id, buildStatePayload(g, p), false, () => {});
  }

  // ----- host applies client actions (single writer => no clobber) -----
  useEffect(() => {
    function onAction(args: { roomId: string; action: string }) {
      if (args.roomId !== roomIdRef.current || !isHostRef.current) return;
      let action: SetAction;
      try {
        action = JSON.parse(args.action);
      } catch {
        return;
      }
      if (action.type === "claim") hostApplyClaim(action.pid, action.cardIds);
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
  // carrying over scores/board/deck; everyone else rejoins with the new code.
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
        window.location.assign("/set/board")
      );
    });
  }

  const value: SetContextValue = {
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
    claimSet,
    hostStart,
    hostRestart,
    kick,
    hostEditPlayer,
    leave,
  };

  return <SetContext.Provider value={value}>{children}</SetContext.Provider>;
}

export { EMPTY_GAME };
export type { SetRoom };

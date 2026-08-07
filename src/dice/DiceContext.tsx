import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import { useRoomConnection } from "../shared/useRoomConnection";
import type { RoomSnapshot } from "../shared/session";
import { buildStatePayload } from "../shared/state";
import type { DiceAction, DiceGame, DicePlayer, DiceRoom } from "./types";

const DICE_SESSION_KEY = "rikiki_dice_room";
const DICE_SNAPSHOT_KEY = "rikiki_dice_snapshot";

const MIN_DICE = 1;
const MAX_DICE = 6;

const EMPTY_GAME: DiceGame = {
  count: 2,
  rollSeq: 0,
  lastRoll: null,
};

type DiceSnapshot = RoomSnapshot<DiceGame, DicePlayer>;

interface DiceContextValue {
  roomId: string;
  setRoomId: (s: string) => void;
  game: DiceGame;
  setGame: (g: DiceGame) => void;
  players: DicePlayer[];
  setPlayers: (p: DicePlayer[]) => void;
  me: DicePlayer | null;
  isHost: boolean;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  recover: DiceSnapshot | null;
  recoverGame: () => void;
  dismissRecover: () => void;
  cancelRestore: () => void;
  saveSession: (roomId: string) => void;
  syncExplicit: (roomId: string, game: DiceGame, players: DicePlayer[]) => void;
  setCount: (count: number) => void;
  roll: () => void;
  kick: (pid: string) => void;
  leave: () => void;
}

const DiceContext = createContext<DiceContextValue | null>(null);

export function useDice(): DiceContextValue {
  const ctx = useContext(DiceContext);
  if (!ctx) throw new Error("useDice must be used within a DiceProvider");
  return ctx;
}

export function DiceProvider({ children }: { children: ReactNode }) {
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
  } = useRoomConnection<DiceGame, DicePlayer>({
    sessionKey: DICE_SESSION_KEY,
    snapshotKey: DICE_SNAPSHOT_KEY,
    emptyGame: EMPTY_GAME,
  });

  const roomIdRef = useRef(roomId);
  const gameRef = useRef(game);
  const rosterRef = useRef<DicePlayer[]>(players);
  const isHostRef = useRef(false);

  function syncNow(g: DiceGame, p: DicePlayer[]) {
    if (!roomIdRef.current) return;
    socket.emit("sync-state", roomIdRef.current, buildStatePayload(g, p), false, () => {});
  }

  function snap(g: DiceGame, p: DicePlayer[]) {
    if (roomIdRef.current) {
      sessionStore.saveSnapshot({ roomId: roomIdRef.current, game: g, players: p });
    }
  }

  // ----- host-only state transitions -----
  function applyAndSync(g: DiceGame, p: DicePlayer[]) {
    gameRef.current = g;
    rosterRef.current = p;
    setGame(g);
    setPlayers(p);
    snap(g, p);
    syncNow(g, p);
  }

  function hostApplySetCount(count: number) {
    const g = gameRef.current;
    const clamped = Math.max(MIN_DICE, Math.min(MAX_DICE, Math.round(count)));
    if (clamped === g.count) return;
    applyAndSync({ ...g, count: clamped }, rosterRef.current);
  }

  function hostApplyRoll(pid: string) {
    const g = gameRef.current;
    const values = Array.from({ length: g.count }, () => 1 + Math.floor(Math.random() * 6));
    applyAndSync({ ...g, rollSeq: g.rollSeq + 1, lastRoll: { values, by: pid } }, rosterRef.current);
  }

  function kick(pid: string) {
    const remaining = rosterRef.current.filter((p) => p.pid !== pid);
    applyAndSync(gameRef.current, remaining);
  }

  function setCount(count: number) {
    if (isHostRef.current) {
      hostApplySetCount(count);
    } else {
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "setCount", count } as DiceAction),
        false,
        () => {}
      );
    }
  }

  function roll() {
    const pid = getPid();
    if (isHostRef.current) {
      hostApplyRoll(pid);
    } else {
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "roll", pid } as DiceAction),
        false,
        () => {}
      );
    }
  }

  function syncExplicit(id: string, g: DiceGame, p: DicePlayer[]) {
    sessionStore.saveSnapshot({ roomId: id, game: g, players: p });
    socket.emit("sync-state", id, buildStatePayload(g, p), false, () => {});
  }

  // ----- host applies client actions (single writer => no clobber) -----
  useEffect(() => {
    function onAction(args: { roomId: string; action: string }) {
      if (args.roomId !== roomIdRef.current || !isHostRef.current) return;
      let parsed: DiceAction;
      try {
        parsed = JSON.parse(args.action);
      } catch {
        return;
      }
      if (parsed.type === "setCount") hostApplySetCount(parsed.count);
      if (parsed.type === "roll") hostApplyRoll(parsed.pid);
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

  // Host resurrects the room from the local snapshot in a brand-new room;
  // everyone else rejoins with the new code.
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
        window.location.assign("/dice/room")
      );
    });
  }

  const value: DiceContextValue = {
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
    setCount,
    roll,
    kick,
    leave,
  };

  return <DiceContext.Provider value={value}>{children}</DiceContext.Provider>;
}

export { EMPTY_GAME };
export type { DiceRoom };

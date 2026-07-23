import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import { useRoomConnection } from "../shared/useRoomConnection";
import type { RoomSnapshot } from "../shared/session";
import { buildStatePayload } from "../shared/state";
import { pickSpectrum, randomTarget } from "./spectra";
import { scoreFor, type WAction, type WGame, type WPlayer, type WRoom } from "./types";

const WAVE_SESSION_KEY = "rikiki_wave_room";
const WAVE_SNAPSHOT_KEY = "rikiki_wave_snapshot";

const EMPTY_GAME: WGame = {
  phase: "lobby",
  round: 0,
  started: false,
  clueGiverPid: null,
  left: "",
  right: "",
  target: 0,
  clue: "",
  finished: false,
};

type WSnapshot = RoomSnapshot<WGame, WPlayer>;

interface WaveContextValue {
  roomId: string;
  setRoomId: (s: string) => void;
  game: WGame;
  setGame: (g: WGame) => void;
  players: WPlayer[];
  setPlayers: (p: WPlayer[]) => void;
  me: WPlayer | null;
  isHost: boolean;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  recover: WSnapshot | null;
  recoverGame: () => void;
  dismissRecover: () => void;
  cancelRestore: () => void;
  saveSession: (roomId: string) => void;
  syncExplicit: (roomId: string, game: WGame, players: WPlayer[]) => void;
  submitClue: (clue: string) => void;
  submitGuess: (value: number) => void;
  hostStart: () => void;
  hostNextRound: () => void;
  hostFinish: () => void;
  hostRestart: () => void;
  kick: (pid: string) => void;
  hostEditPlayer: (pid: string, name: string, score?: number) => void;
  leave: () => void;
}

const WaveContext = createContext<WaveContextValue | null>(null);

export function useWave(): WaveContextValue {
  const ctx = useContext(WaveContext);
  if (!ctx) throw new Error("useWave must be used within a WaveProvider");
  return ctx;
}

export function WaveProvider({ children }: { children: ReactNode }) {
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
  } = useRoomConnection<WGame, WPlayer>({
    sessionKey: WAVE_SESSION_KEY,
    snapshotKey: WAVE_SNAPSHOT_KEY,
    emptyGame: EMPTY_GAME,
  });

  const roomIdRef = useRef(roomId);
  const gameRef = useRef(game);
  const rosterRef = useRef<WPlayer[]>(players);
  const isHostRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function syncNow(g: WGame, p: WPlayer[]) {
    if (!roomIdRef.current) return;
    socket.emit("sync-state", roomIdRef.current, buildStatePayload(g, p), false, () => {});
  }
  function schedulePush() {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      syncNow(gameRef.current, rosterRef.current);
    }, 80);
  }

  function snap(g: WGame, p: WPlayer[]) {
    if (roomIdRef.current) {
      sessionStore.saveSnapshot({ roomId: roomIdRef.current, game: g, players: p });
    }
  }

  // ----- host-only state transitions -----
  function applyAndSync(g: WGame, p: WPlayer[]) {
    gameRef.current = g;
    rosterRef.current = p;
    setGame(g);
    setPlayers(p);
    snap(g, p);
    syncNow(g, p);
  }

  function buildRound(prevLeft: string | undefined, giverPid: string | null, round: number) {
    const [left, right] = pickSpectrum(prevLeft);
    const reset = rosterRef.current.map((p) => ({
      ...p,
      guess: null,
      guessed: false,
      gained: undefined,
    }));
    const g: WGame = {
      phase: "clue",
      round,
      started: true,
      clueGiverPid: giverPid,
      left,
      right,
      target: randomTarget(),
      clue: "",
    };
    return { g, p: reset };
  }

  function hostStart() {
    const ps = rosterRef.current;
    if (ps.length < 2) return;
    const giver = ps[0]?.pid ?? null;
    const { g, p } = buildRound(undefined, giver, 1);
    applyAndSync(g, p);
  }

  function hostNextRound() {
    const ps = rosterRef.current;
    const order = ps.map((p) => p.pid);
    const idx = order.indexOf(gameRef.current.clueGiverPid || "");
    const nextGiver = order[(idx + 1) % order.length] ?? order[0];
    const { g, p } = buildRound(gameRef.current.left, nextGiver, gameRef.current.round + 1);
    applyAndSync(g, p);
  }

  function hostFinish() {
    const g = gameRef.current;
    applyAndSync({ ...g, finished: true }, rosterRef.current);
  }

  function hostRestart() {
    const ps = rosterRef.current
      .map((p) => ({
        ...p,
        score: 0,
        guess: null,
        guessed: false,
        gained: undefined,
      }));
    rosterRef.current = ps;
    const giver = ps[0]?.pid ?? null;
    const { g, p } = buildRound(undefined, giver, 1);
    applyAndSync(g, p);
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

  function hostApplyClue(clue: string) {
    const g = gameRef.current;
    if (g.phase !== "clue") return;
    const ng = { ...g, clue, phase: "guess" as const };
    gameRef.current = ng;
    setGame(ng);
    snap(ng, rosterRef.current);
    syncNow(ng, rosterRef.current);
  }

  function hostApplyGuess(pid: string, value: number) {
    const g = gameRef.current;
    if (g.phase !== "guess") return;
    let ps = rosterRef.current.map((p) =>
      p.pid === pid ? { ...p, guess: value, guessed: true } : p
    );
    rosterRef.current = ps;

    const expected = ps.filter((p) => p.online && p.pid !== g.clueGiverPid);
    const allIn = expected.length > 0 && expected.every((p) => p.guessed);

    if (!allIn) {
      setPlayers(ps);
      snap(g, ps);
      schedulePush();
      return;
    }

    // reveal + score
    ps = ps.map((p) => {
      if (p.pid === g.clueGiverPid || p.guess == null) return { ...p, gained: 0 };
      const pts = scoreFor(Math.abs(p.guess - g.target));
      return { ...p, gained: pts, score: p.score + pts };
    });
    const guessers = ps.filter((p) => p.online && p.pid !== g.clueGiverPid);
    const avg = guessers.length
      ? Math.round(guessers.reduce((a, p) => a + (p.gained || 0), 0) / guessers.length)
      : 0;
    ps = ps.map((p) =>
      p.pid === g.clueGiverPid ? { ...p, gained: avg, score: p.score + avg } : p
    );
    const ng = { ...g, phase: "reveal" as const };
    applyAndSync(ng, ps);
  }

  // ----- player-facing actions -----
  function submitClue(clue: string) {
    if (isHostRef.current) hostApplyClue(clue);
    else
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "clue", clue } as WAction),
        false,
        () => {}
      );
  }

  function submitGuess(value: number) {
    const pid = getPid();
    if (isHostRef.current) {
      hostApplyGuess(pid, value);
    } else {
      // optimistic local: mark myself as guessed
      setPlayers((prev) =>
        prev.map((p) => (p.pid === pid ? { ...p, guess: value, guessed: true } : p))
      );
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "guess", pid, value } as WAction),
        false,
        () => {}
      );
    }
  }

  function syncExplicit(id: string, g: WGame, p: WPlayer[]) {
    // Snapshot immediately so backend-restart recovery works from the very
    // first push (the broadcast echo may race the roomId state update).
    sessionStore.saveSnapshot({ roomId: id, game: g, players: p });
    socket.emit("sync-state", id, buildStatePayload(g, p), false, () => {});
  }

  // ----- host applies client actions (single writer => no clobber) -----
  useEffect(() => {
    function onAction(args: { roomId: string; action: string }) {
      if (args.roomId !== roomIdRef.current || !isHostRef.current) return;
      let action: WAction;
      try {
        action = JSON.parse(args.action);
      } catch {
        return;
      }
      if (action.type === "clue") hostApplyClue(action.clue);
      else if (action.type === "guess") hostApplyGuess(action.pid, action.value);
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
  // carrying over scores/round; everyone else rejoins with the new code.
  function recoverGame() {
    if (!recover) return;
    const snapshot = recover;
    const pid = getPid();
    socket.emit("create-room", 12, (resp) => {
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
        window.location.assign("/wave/room")
      );
    });
  }

  const value: WaveContextValue = {
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
    submitClue,
    submitGuess,
    hostStart,
    hostNextRound,
    hostFinish,
    hostRestart,
    kick,
    hostEditPlayer,
    leave,
  };

  return <WaveContext.Provider value={value}>{children}</WaveContext.Provider>;
}

export { EMPTY_GAME };

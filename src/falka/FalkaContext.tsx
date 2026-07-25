import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import { useRoomConnection } from "../shared/useRoomConnection";
import type { RoomSnapshot } from "../shared/session";
import { buildStatePayload } from "../shared/state";
import {
  assignRoles,
  checkWinner,
  computeSuspicionRanking,
  pickEvidence,
  resetRoundFields,
  tallyLynch,
  tallyMajority,
} from "./roles";
import type { FAction, FGame, FPlayer, SeerResult } from "./types";

const FALKA_SESSION_KEY = "rikiki_falka_room";
const FALKA_SNAPSHOT_KEY = "rikiki_falka_snapshot";
const FALKA_ROOM_SIZE = 6; // role tables only cover 5-6 players

const NIGHT_MS = 45_000;
const DAY_MS = 180_000;
const VOTE_MS = 60_000;

const EMPTY_GAME: FGame = {
  started: false,
  finished: false,
  round: 0,
  phase: "lobby",
  phaseDeadline: null,
  winner: null,
  nightKillPid: null,
  seerResult: null,
  evidence: [],
  suspicionRanking: null,
  lynchedPid: null,
};

type FSnapshot = RoomSnapshot<FGame, FPlayer>;

interface FalkaContextValue {
  roomId: string;
  setRoomId: (s: string) => void;
  game: FGame;
  setGame: (g: FGame) => void;
  players: FPlayer[];
  setPlayers: (p: FPlayer[]) => void;
  me: FPlayer | null;
  isHost: boolean;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  recover: FSnapshot | null;
  recoverGame: () => void;
  dismissRecover: () => void;
  cancelRestore: () => void;
  saveSession: (roomId: string) => void;
  syncExplicit: (roomId: string, game: FGame, players: FPlayer[]) => void;
  submitWolfVote: (targetPid: string) => void;
  submitSeerCheck: (targetPid: string) => void;
  submitSuspicion: (ratings: Record<string, number>) => void;
  submitLynchVote: (targetPid: string) => void;
  hostStart: () => void;
  hostAdvanceFromDawn: () => void;
  hostAdvanceFromResults: () => void;
  hostRestart: () => void;
  kick: (pid: string) => void;
  hostEditPlayer: (pid: string, name: string) => void;
  leave: () => void;
}

const FalkaContext = createContext<FalkaContextValue | null>(null);

export function useFalka(): FalkaContextValue {
  const ctx = useContext(FalkaContext);
  if (!ctx) throw new Error("useFalka must be used within a FalkaProvider");
  return ctx;
}

export function FalkaProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
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
  } = useRoomConnection<FGame, FPlayer>({
    sessionKey: FALKA_SESSION_KEY,
    snapshotKey: FALKA_SNAPSHOT_KEY,
    emptyGame: EMPTY_GAME,
  });

  const roomIdRef = useRef(roomId);
  const gameRef = useRef(game);
  const rosterRef = useRef<FPlayer[]>(players);
  const isHostRef = useRef(false);

  function syncNow(g: FGame, p: FPlayer[]) {
    if (!roomIdRef.current) return;
    socket.emit("sync-state", roomIdRef.current, buildStatePayload(g, p), false, () => {});
  }

  function snap(g: FGame, p: FPlayer[]) {
    if (roomIdRef.current) {
      sessionStore.saveSnapshot({ roomId: roomIdRef.current, game: g, players: p });
    }
  }

  // ----- host-only state transitions -----
  function applyAndSync(g: FGame, p: FPlayer[]) {
    gameRef.current = g;
    rosterRef.current = p;
    setGame(g);
    setPlayers(p);
    snap(g, p);
    syncNow(g, p);
  }

  function hostStart() {
    const ps = assignRoles(rosterRef.current);
    applyAndSync(
      {
        started: true,
        finished: false,
        round: 1,
        phase: "night",
        phaseDeadline: Date.now() + NIGHT_MS,
        winner: null,
        nightKillPid: null,
        seerResult: null,
        evidence: [],
        suspicionRanking: null,
        lynchedPid: null,
      },
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

  function hostEditPlayer(pid: string, name: string) {
    const ps = rosterRef.current.map((p) => (p.pid === pid ? { ...p, name } : p));
    applyAndSync(gameRef.current, ps);
  }

  // ----- night -----
  function hostApplyWolfVote(pid: string, targetPid: string) {
    const g = gameRef.current;
    if (g.phase !== "night") return;
    const ps = rosterRef.current.map((p) =>
      p.pid === pid && p.alive && p.role === "wolf" ? { ...p, nightVote: targetPid } : p
    );
    applyAndSync(g, ps);
    hostMaybeAdvanceNight();
  }

  function hostApplySeerCheck(pid: string, targetPid: string) {
    const g = gameRef.current;
    if (g.phase !== "night") return;
    const ps = rosterRef.current.map((p) =>
      p.pid === pid && p.alive && p.role === "seer" ? { ...p, seerCheckPid: targetPid } : p
    );
    applyAndSync(g, ps);
    hostMaybeAdvanceNight();
  }

  function hostMaybeAdvanceNight() {
    const g = gameRef.current;
    if (g.phase !== "night") return;
    const ps = rosterRef.current;
    const aliveWolves = ps.filter((p) => p.alive && p.role === "wolf");
    const aliveSeer = ps.find((p) => p.alive && p.role === "seer");
    const wolvesDone = aliveWolves.length === 0 || aliveWolves.every((p) => !!p.nightVote);
    const seerDone = !aliveSeer || !!aliveSeer.seerCheckPid;
    const timeUp = !!g.phaseDeadline && Date.now() >= g.phaseDeadline;
    if (!timeUp && !(wolvesDone && seerDone)) return;
    resolveNight();
  }

  function resolveNight() {
    const g = gameRef.current;
    const before = rosterRef.current;

    const aliveWolves = before.filter((p) => p.alive && p.role === "wolf");
    const killVotes = aliveWolves
      .map((p) => p.nightVote)
      .filter((v): v is string => !!v);
    const killPid = tallyMajority(killVotes);

    const seer = before.find((p) => p.role === "seer");
    let seerResult: SeerResult | null = null;
    if (seer && seer.alive && seer.seerCheckPid) {
      const target = before.find((p) => p.pid === seer.seerCheckPid);
      if (target) {
        seerResult = {
          forPid: seer.pid,
          targetPid: target.pid,
          isWolf: target.role === "wolf" || target.role === "wildcard",
        };
      }
    }

    let ps = before;
    if (killPid) {
      ps = ps.map((p) => (p.pid === killPid ? { ...p, alive: false } : p));
    }

    const winner = checkWinner(ps);

    applyAndSync(
      {
        ...g,
        phase: "dawn",
        phaseDeadline: null,
        nightKillPid: killPid,
        seerResult,
        evidence: pickEvidence(t("falka.evidence", { returnObjects: true }) as string[], 3),
        winner: winner ?? g.winner,
      },
      ps
    );
  }

  function hostAdvanceFromDawn() {
    const g = gameRef.current;
    if (g.phase !== "dawn") return;
    if (g.winner) {
      applyAndSync({ ...g, phase: "gameover", finished: true }, rosterRef.current);
      return;
    }
    applyAndSync(
      { ...g, phase: "day", phaseDeadline: Date.now() + DAY_MS, suspicionRanking: null },
      rosterRef.current
    );
  }

  // ----- day -----
  function hostApplySuspicion(pid: string, ratings: Record<string, number>) {
    const g = gameRef.current;
    if (g.phase !== "day") return;
    const ps = rosterRef.current.map((p) =>
      p.pid === pid && p.alive ? { ...p, suspicionBallot: ratings } : p
    );
    applyAndSync(g, ps);
    hostMaybeAdvanceDay();
  }

  function hostMaybeAdvanceDay() {
    const g = gameRef.current;
    if (g.phase !== "day") return;
    const alive = rosterRef.current.filter((p) => p.alive);
    const allSubmitted = alive.every((p) => !!p.suspicionBallot);
    const timeUp = !!g.phaseDeadline && Date.now() >= g.phaseDeadline;
    if (!timeUp && !allSubmitted) return;
    resolveDay();
  }

  function resolveDay() {
    const g = gameRef.current;
    const ps = rosterRef.current;
    const ranking = computeSuspicionRanking(ps);
    applyAndSync(
      { ...g, phase: "vote", phaseDeadline: Date.now() + VOTE_MS, suspicionRanking: ranking },
      ps
    );
  }

  // ----- vote -----
  function hostApplyLynchVote(pid: string, targetPid: string) {
    const g = gameRef.current;
    if (g.phase !== "vote") return;
    const ps = rosterRef.current.map((p) =>
      p.pid === pid && p.alive ? { ...p, lynchVote: targetPid } : p
    );
    applyAndSync(g, ps);
    hostMaybeAdvanceVote();
  }

  function hostMaybeAdvanceVote() {
    const g = gameRef.current;
    if (g.phase !== "vote") return;
    const alive = rosterRef.current.filter((p) => p.alive);
    const allVoted = alive.every((p) => !!p.lynchVote);
    const timeUp = !!g.phaseDeadline && Date.now() >= g.phaseDeadline;
    if (!timeUp && !allVoted) return;
    resolveVote();
  }

  function resolveVote() {
    const g = gameRef.current;
    const alive = rosterRef.current.filter((p) => p.alive);
    const votes = alive.map((p) => p.lynchVote).filter((v): v is string => !!v);
    const lynchedPid = tallyLynch(votes);

    let ps = rosterRef.current;
    if (lynchedPid) {
      ps = ps.map((p) => (p.pid === lynchedPid ? { ...p, alive: false } : p));
    }

    const winner = checkWinner(ps);
    applyAndSync(
      { ...g, phase: "results", phaseDeadline: null, lynchedPid, winner: winner ?? g.winner },
      ps
    );
  }

  function hostAdvanceFromResults() {
    const g = gameRef.current;
    if (g.phase !== "results") return;
    if (g.winner) {
      applyAndSync({ ...g, phase: "gameover", finished: true }, rosterRef.current);
      return;
    }
    const ps = resetRoundFields(rosterRef.current);
    applyAndSync(
      {
        ...g,
        round: g.round + 1,
        phase: "night",
        phaseDeadline: Date.now() + NIGHT_MS,
        nightKillPid: null,
        seerResult: null,
        evidence: [],
        lynchedPid: null,
      },
      ps
    );
  }

  // ----- player-facing actions -----
  function submitWolfVote(targetPid: string) {
    const pid = getPid();
    if (isHostRef.current) hostApplyWolfVote(pid, targetPid);
    else
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "wolfVote", pid, targetPid } as FAction),
        false,
        () => {}
      );
  }

  function submitSeerCheck(targetPid: string) {
    const pid = getPid();
    if (isHostRef.current) hostApplySeerCheck(pid, targetPid);
    else
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "seerCheck", pid, targetPid } as FAction),
        false,
        () => {}
      );
  }

  function submitSuspicion(ratings: Record<string, number>) {
    const pid = getPid();
    if (isHostRef.current) hostApplySuspicion(pid, ratings);
    else
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "suspicion", pid, ratings } as FAction),
        false,
        () => {}
      );
  }

  function submitLynchVote(targetPid: string) {
    const pid = getPid();
    if (isHostRef.current) hostApplyLynchVote(pid, targetPid);
    else
      socket.emit(
        "sync-action",
        roomIdRef.current,
        JSON.stringify({ type: "lynchVote", pid, targetPid } as FAction),
        false,
        () => {}
      );
  }

  function syncExplicit(id: string, g: FGame, p: FPlayer[]) {
    sessionStore.saveSnapshot({ roomId: id, game: g, players: p });
    socket.emit("sync-state", id, buildStatePayload(g, p), false, () => {});
  }

  // ----- host applies client actions (single writer => no clobber) -----
  useEffect(() => {
    function onAction(args: { roomId: string; action: string }) {
      if (args.roomId !== roomIdRef.current || !isHostRef.current) return;
      let action: FAction;
      try {
        action = JSON.parse(args.action);
      } catch {
        return;
      }
      if (action.type === "wolfVote") hostApplyWolfVote(action.pid, action.targetPid);
      else if (action.type === "seerCheck") hostApplySeerCheck(action.pid, action.targetPid);
      else if (action.type === "suspicion") hostApplySuspicion(action.pid, action.ratings);
      else if (action.type === "lynchVote") hostApplyLynchVote(action.pid, action.targetPid);
    }
    socket.on("action-sent", onAction);
    return () => {
      socket.off("action-sent", onAction);
    };
    // handlers read everything from refs; intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Host-only clock: every second, force through any timed phase whose
  // deadline has passed (or whose required actions are all in) — this is
  // what stands in for a human moderator keeping the game moving.
  useEffect(() => {
    const id = setInterval(() => {
      if (!isHostRef.current) return;
      const phase = gameRef.current.phase;
      if (phase === "night") hostMaybeAdvanceNight();
      else if (phase === "day") hostMaybeAdvanceDay();
      else if (phase === "vote") hostMaybeAdvanceVote();
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const me = players.find((p) => p.pid === getPid()) ?? null;
  const isHost = !!(me && me.boss);

  roomIdRef.current = roomId;
  gameRef.current = game;
  rosterRef.current = players;
  isHostRef.current = isHost;

  // Host resurrects the game from the local snapshot in a brand-new room,
  // carrying over roles/round/phase; everyone else rejoins with the new code.
  function recoverGame() {
    if (!recover) return;
    const snapshot = recover;
    const pid = getPid();
    socket.emit("create-room", FALKA_ROOM_SIZE, (resp) => {
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
        window.location.assign("/falka/room")
      );
    });
  }

  const value: FalkaContextValue = {
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
    submitWolfVote,
    submitSeerCheck,
    submitSuspicion,
    submitLynchVote,
    hostStart,
    hostAdvanceFromDawn,
    hostAdvanceFromResults,
    hostRestart,
    kick,
    hostEditPlayer,
    leave,
  };

  return <FalkaContext.Provider value={value}>{children}</FalkaContext.Provider>;
}

export { EMPTY_GAME, FALKA_ROOM_SIZE };
export type { FRoom } from "./types";

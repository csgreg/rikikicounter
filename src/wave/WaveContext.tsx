import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
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

// Last known full room state, kept so a host can resurrect the game if the
// backend restarts (free tier) and the room disappears server-side.
interface WSnapshot {
  roomId: string;
  game: WGame;
  players: WPlayer[];
}

function saveWaveSnapshot(snap: WSnapshot): void {
  localStorage.setItem(WAVE_SNAPSHOT_KEY, JSON.stringify(snap));
}
function loadWaveSnapshot(): WSnapshot | null {
  try {
    return (
      (JSON.parse(localStorage.getItem(WAVE_SNAPSHOT_KEY) || "null") as WSnapshot) ||
      null
    );
  } catch {
    return null;
  }
}
function clearWaveSnapshot(): void {
  localStorage.removeItem(WAVE_SNAPSHOT_KEY);
}

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
  syncExplicit: (roomId: string, game: WGame, players: WPlayer[]) => void;
  submitClue: (clue: string) => void;
  submitGuess: (value: number) => void;
  hostStart: () => void;
  hostNextRound: () => void;
  hostFinish: () => void;
  hostRestart: () => void;
  kick: (pid: string) => void;
  leave: () => void;
}

const WaveContext = createContext<WaveContextValue | null>(null);

export function useWave(): WaveContextValue {
  const ctx = useContext(WaveContext);
  if (!ctx) throw new Error("useWave must be used within a WaveProvider");
  return ctx;
}

function payload(game: WGame, players: WPlayer[]): string {
  return `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(
    players
  )} }`;
}

export function WaveProvider({ children }: { children: ReactNode }) {
  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState<WGame>(EMPTY_GAME);
  const [players, setPlayers] = useState<WPlayer[]>([]);
  const [connected, setConnected] = useState(socket.connected);
  const [restoring, setRestoring] = useState<boolean>(
    () => !!localStorage.getItem(WAVE_SESSION_KEY)
  );
  const [kicked, setKicked] = useState(false);
  const [recover, setRecover] = useState<WSnapshot | null>(null);

  const roomIdRef = useRef(roomId);
  const gameRef = useRef(game);
  const rosterRef = useRef<WPlayer[]>(players);
  const isHostRef = useRef(false);
  const pushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function syncNow(g: WGame, p: WPlayer[]) {
    if (!roomIdRef.current) return;
    socket.emit("sync-state", roomIdRef.current, payload(g, p), false, () => {});
  }
  function schedulePush() {
    if (pushTimerRef.current) clearTimeout(pushTimerRef.current);
    pushTimerRef.current = setTimeout(() => {
      syncNow(gameRef.current, rosterRef.current);
    }, 80);
  }

  function snap(g: WGame, p: WPlayer[]) {
    if (roomIdRef.current) {
      saveWaveSnapshot({ roomId: roomIdRef.current, game: g, players: p });
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
    socket.emit("sync-state", id, payload(g, p), false, () => {});
  }

  // ----- connection -----
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

  // ----- state sync -----
  useEffect(() => {
    function onStateChanged(args: { roomId: string; state: string }) {
      if (args.roomId !== roomId) return;
      const state = JSON.parse(args.state) as WRoom;
      const pid = getPid();
      // We had a seat but it's gone now -> the host kicked us.
      if (
        !state.players.some((p) => p.pid === pid) &&
        localStorage.getItem(WAVE_SESSION_KEY)
      ) {
        localStorage.removeItem(WAVE_SESSION_KEY);
        clearWaveSnapshot();
        setKicked(true);
        return;
      }
      setGame(state.game);
      setPlayers(state.players);
      saveWaveSnapshot({ roomId, game: state.game, players: state.players });
    }
    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
  }, [roomId]);

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

  // ----- restore -----
  useEffect(() => {
    const saved = localStorage.getItem(WAVE_SESSION_KEY);
    if (!saved) {
      setRestoring(false);
      return;
    }
    const pid = getPid();
    const restore = () => {
      socket.emit("join-room", saved, (res) => {
        if (!res || res.status !== "ok") {
          // Room is gone server-side (e.g. the backend restarted). If we have a
          // snapshot of this room, offer to resurrect it instead of bailing.
          const snapshot = loadWaveSnapshot();
          if (
            snapshot &&
            snapshot.roomId === saved &&
            snapshot.players.some((p) => p.pid === pid)
          ) {
            setRecover(snapshot);
          } else {
            localStorage.removeItem(WAVE_SESSION_KEY);
            clearWaveSnapshot();
          }
          setRestoring(false);
          return;
        }
        setRoomId(saved);
        socket.emit("get-state", saved, (stateRes) => {
          try {
            if (!stateRes.state) throw new Error("no state");
            const obj = JSON.parse(JSON.parse(stateRes.state)) as WRoom;
            const idx = obj.players.findIndex((p) => p.pid === pid);
            if (idx === -1) {
              // Our seat is gone (kicked while we were away).
              localStorage.removeItem(WAVE_SESSION_KEY);
              clearWaveSnapshot();
              setKicked(true);
              setRestoring(false);
              return;
            }
            obj.players[idx].socketid = socket.id;
            obj.players[idx].online = true;
            setGame(obj.game);
            setPlayers(obj.players);
            saveWaveSnapshot({ roomId: saved, game: obj.game, players: obj.players });
            socket.emit("sync-state", saved, payload(obj.game, obj.players), false, () => {});
          } catch {
            localStorage.removeItem(WAVE_SESSION_KEY);
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

  roomIdRef.current = roomId;
  gameRef.current = game;
  rosterRef.current = players;
  isHostRef.current = isHost;

  function leave() {
    const pid = getPid();
    const list = rosterRef.current;
    const leaving = list.find((p) => p.pid === pid);
    const remaining = list.filter((p) => p.pid !== pid);
    // Hand over the host role if we were the host.
    if (leaving?.boss && remaining.length > 0 && !remaining.some((p) => p.boss)) {
      const heir = remaining.find((p) => p.online) || remaining[0];
      heir.boss = true;
    }
    if (roomIdRef.current && remaining.length > 0) {
      syncNow(gameRef.current, remaining);
    }
    localStorage.removeItem(WAVE_SESSION_KEY);
    clearWaveSnapshot();
    setRoomId("");
    setGame(EMPTY_GAME);
    setPlayers([]);
  }

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
      localStorage.setItem(WAVE_SESSION_KEY, newRoomId);
      saveWaveSnapshot({ roomId: newRoomId, game, players });
      socket.emit("sync-state", newRoomId, payload(game, players), false, () =>
        window.location.assign("/wave/room")
      );
    });
  }

  function dismissRecover() {
    localStorage.removeItem(WAVE_SESSION_KEY);
    clearWaveSnapshot();
    setRecover(null);
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
    syncExplicit,
    submitClue,
    submitGuess,
    hostStart,
    hostNextRound,
    hostFinish,
    hostRestart,
    kick,
    leave,
  };

  return <WaveContext.Provider value={value}>{children}</WaveContext.Provider>;
}

export { WAVE_SESSION_KEY, EMPTY_GAME };

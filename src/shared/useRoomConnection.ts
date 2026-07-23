import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { socket } from "../api/socket";
import { getPid } from "../api/session";
import {
  createSessionStore,
  type RoomSnapshot,
  type SessionStore,
} from "./session";
import {
  buildStatePayload,
  parseBroadcastState,
  parseFetchedState,
} from "./state";

// The subset of a game's player shape the connection engine actually needs
// to reason about — everything else about TPlayer/TGame is opaque to it.
export interface RoomPlayer {
  pid: string;
  socketid: string;
  boss: boolean;
  online: boolean;
}

export interface RoomConnectionConfig<TGame> {
  // Literal, not derived, so existing players' saved localStorage sessions
  // keep working unchanged when a game adopts this hook.
  sessionKey: string;
  snapshotKey: string;
  emptyGame: TGame;
}

export interface RoomConnectionState<TGame, TPlayer extends RoomPlayer> {
  roomId: string;
  setRoomId: Dispatch<SetStateAction<string>>;
  game: TGame;
  setGame: Dispatch<SetStateAction<TGame>>;
  players: TPlayer[];
  setPlayers: Dispatch<SetStateAction<TPlayer[]>>;
  connected: boolean;
  restoring: boolean;
  kicked: boolean;
  resetKicked: () => void;
  recover: RoomSnapshot<TGame, TPlayer> | null;
  dismissRecover: () => void;
  cancelRestore: () => void;
  leave: () => void;
  // Exposed so a game's own extra flows (create/join seat resolution, a
  // custom recoverGame, host-authority pushes) can reuse the exact same
  // storage the resync engine reads from, without standing up a second store.
  sessionStore: SessionStore<TGame, TPlayer>;
}

// Connect/reconnect/join/leave/state-sync engine shared by every game in
// this app. A game binds it to its own literal storage keys + TGame/TPlayer
// and gets back room/connection state plus leave()/cancelRestore()/recover
// handling; it still owns everything about its own rules (turn order, scoring,
// host-authority actions) on top of the roomId/game/players this returns.
export function useRoomConnection<TGame, TPlayer extends RoomPlayer>(
  config: RoomConnectionConfig<TGame>
): RoomConnectionState<TGame, TPlayer> {
  const { sessionKey, snapshotKey, emptyGame } = config;
  const sessionStore = createSessionStore<TGame, TPlayer>(sessionKey, snapshotKey);

  const [roomId, setRoomId] = useState("");
  const [game, setGame] = useState<TGame>(emptyGame);
  const [players, setPlayers] = useState<TPlayer[]>([]);
  const [restoring, setRestoring] = useState<boolean>(() => sessionStore.hasSession());
  const [connected, setConnected] = useState(socket.connected);
  const [kicked, setKicked] = useState(false);
  const [recover, setRecover] = useState<RoomSnapshot<TGame, TPlayer> | null>(null);

  const roomIdRef = useRef(roomId);
  roomIdRef.current = roomId;
  const restoringRef = useRef(restoring);
  restoringRef.current = restoring;
  // Flipped by cancelRestore() so a user stuck on the "Visszacsatlakozás"
  // screen can bail out; every async checkpoint in the resync effect below
  // already checks `disposed` for the same reason (component unmounted), so
  // it's checked alongside it rather than needing a second set of guards.
  const abortedRef = useRef(false);

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
      if (args.roomId !== roomId && args.roomId !== sessionStore.loadSession()?.roomId) {
        return;
      }
      const state = parseBroadcastState<TGame, TPlayer>(args.state);
      const pid = getPid();
      const myIdx = state.players.findIndex((p) => p.pid === pid);

      // We had a seat but it's gone now -> the host kicked us.
      if (myIdx === -1 && sessionStore.hasSession()) {
        sessionStore.clearSession();
        sessionStore.clearSnapshot();
        setKicked(true);
        return;
      }

      setGame(state.game);
      setPlayers(state.players);
      // Keep a local snapshot for backend-restart recovery.
      sessionStore.saveSnapshot({
        roomId: args.roomId,
        game: state.game,
        players: state.players,
      });
    }

    socket.on("state-changed", onStateChanged);
    return () => {
      socket.off("state-changed", onStateChanged);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (disposed || abortedRef.current) return;
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

    function adoptState(id: string, obj: { game: TGame; players: TPlayer[] }, push: boolean) {
      const pid = getPid();
      const idx = obj.players.findIndex((p) => p.pid === pid);
      if (idx === -1) {
        // Our seat is gone (kicked while we were away).
        sessionStore.clearSession();
        sessionStore.clearSnapshot();
        setKicked(true);
        settle();
        return;
      }
      // Our socket.id changed on reconnect — update it + mark online.
      obj.players[idx].socketid = socket.id;
      obj.players[idx].online = true;
      setRoomId(id);
      setGame(obj.game);
      setPlayers(obj.players);
      sessionStore.saveSnapshot({ roomId: id, game: obj.game, players: obj.players });
      if (push) {
        socket.emit("sync-state", id, buildStatePayload(obj.game, obj.players), false, () => {});
      }
      failCount = 0;
      setRecover(null); // the room is back — retract a pending recovery offer
      settle();
    }

    function resync() {
      if (disposed || abortedRef.current) return;
      const id = roomIdRef.current || sessionStore.loadSession()?.roomId || "";
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
        if (disposed || abortedRef.current) return;
        if (!res || res.status !== "ok") {
          const snap = sessionStore.loadSnapshot();
          if (snap && snap.roomId === id && snap.players.some((p) => p.pid === pid)) {
            // join-room failed. Probe with get-state first: if the room still
            // EXISTS (join refused for another reason, e.g. capacity), adopt
            // its live state read-only and retry joining later — never
            // overwrite a live room with our snapshot.
            socket.emit("get-state", id, (probe) => {
              if (disposed || abortedRef.current) return;
              try {
                if (!probe.state) throw new Error("room gone");
                const live = parseFetchedState<TGame, TPlayer>(probe.state);
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
                    if (disposed || abortedRef.current) return;
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
          if (disposed || abortedRef.current) return;
          try {
            if (!stateRes.state) throw new Error("missing state");
            adoptState(id, parseFetchedState<TGame, TPlayer>(stateRes.state), firstRestore);
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
    // handlers read everything from refs; intentionally run once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismissRecover() {
    sessionStore.clearSession();
    sessionStore.clearSnapshot();
    setRoomId("");
    setRecover(null);
  }

  // Lets a user stuck on the "Visszacsatlakozás" screen bail out instead of
  // waiting forever on a socket that may never reconnect.
  function cancelRestore() {
    abortedRef.current = true;
    sessionStore.clearSession();
    sessionStore.clearSnapshot();
    setRoomId("");
    setRestoring(false);
  }

  // Hand over the host role if we were the host, push the resulting roster
  // (even if it's now empty, so the server's copy is never stale), then
  // actually leave the socket.io room — without this last step the socket
  // stays a member server-side forever (it survives SPA navigation), and a
  // later join-room for the same code fails with "already in this room".
  function leave() {
    const pid = getPid();
    const leaving = players.find((p) => p.pid === pid);
    const remaining = players.filter((p) => p.pid !== pid);
    if (leaving?.boss && remaining.length > 0 && !remaining.some((p) => p.boss)) {
      const heir = remaining.find((p) => p.online) || remaining[0];
      heir.boss = true;
    }
    if (roomId) {
      socket.emit("sync-state", roomId, buildStatePayload(game, remaining), false, () => {});
      socket.emit("leave-room", roomId, () => {});
    }
    sessionStore.clearSession();
    sessionStore.clearSnapshot();
    setRoomId("");
    setGame(emptyGame);
    setPlayers([]);
  }

  return {
    roomId,
    setRoomId,
    game,
    setGame,
    players,
    setPlayers,
    connected,
    restoring,
    kicked,
    resetKicked: () => setKicked(false),
    recover,
    dismissRecover,
    cancelRestore,
    leave,
    sessionStore,
  };
}

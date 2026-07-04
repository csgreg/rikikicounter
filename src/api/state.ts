import type { GameMeta, Player, RoomState } from "../types";
import type { TypedSocket } from "./socket";
import { saveSnapshot } from "./session";

// Build the exact payload string the backend expects for sync-state.
export function buildStatePayload(game: GameMeta, players: Player[]): string {
  return `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(
    players
  )} }`;
}

// Push the current room state to the server (and let it broadcast it).
// Every push also refreshes the local snapshot, so backend-restart recovery
// always has an up-to-date state to resurrect the room from.
export function syncState(
  socket: TypedSocket,
  roomId: string,
  game: GameMeta,
  players: Player[]
): void {
  saveSnapshot({ roomId, game, players });
  socket.emit("sync-state", roomId, buildStatePayload(game, players), false, () => {});
}

// "state-changed" broadcasts are single-encoded.
export function parseBroadcastState(state: string): RoomState {
  return JSON.parse(state) as RoomState;
}

// "get-state" returns the DB value, which is double-encoded.
export function parseFetchedState(state: string): RoomState {
  return JSON.parse(JSON.parse(state)) as RoomState;
}

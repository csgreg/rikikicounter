import type { GameMeta, Player, RoomState } from "../types";
import type { TypedSocket } from "./socket";
import { saveSnapshot } from "./session";
import {
  buildStatePayload as buildStatePayloadGeneric,
  parseBroadcastState as parseBroadcastStateGeneric,
  parseFetchedState as parseFetchedStateGeneric,
} from "../shared/state";

// Build the exact payload string the backend expects for sync-state.
export function buildStatePayload(game: GameMeta, players: Player[]): string {
  return buildStatePayloadGeneric(game, players);
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
  return parseBroadcastStateGeneric<GameMeta, Player>(state);
}

// "get-state" returns the DB value, which is double-encoded.
export function parseFetchedState(state: string): RoomState {
  return parseFetchedStateGeneric<GameMeta, Player>(state);
}

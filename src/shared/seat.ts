import type { RoomPlayer } from "./useRoomConnection";

// Shared "adopt or resume a seat" policy used by every game's join/create
// flow: a returning pid resumes its existing seat in place (refreshed
// socketid/online/name), a genuinely new pid gets a brand-new seat and
// becomes host if the room is currently host-less. Each game supplies its
// own player shape (sit-out flags, score fields, etc.) via makeNewPlayer —
// this stays agnostic to everything except the 4 RoomPlayer fields.
export function resolveSeat<TPlayer extends RoomPlayer>(
  players: TPlayer[],
  pid: string,
  updateExisting: (existing: TPlayer) => void,
  makeNewPlayer: (isHostAdopt: boolean) => TPlayer
): { player: TPlayer; isNew: boolean } {
  const existing = players.find((p) => p.pid === pid);
  if (existing) {
    updateExisting(existing);
    return { player: existing, isNew: false };
  }
  const isHostAdopt = !players.some((p) => p.boss);
  const player = makeNewPlayer(isHostAdopt);
  players.push(player);
  return { player, isNew: true };
}

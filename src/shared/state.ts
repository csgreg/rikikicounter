// Generic sync-state wire encoding shared by every game. The payload shape
// and the single/double-encoding convention are identical across games —
// only TGame/TPlayer differ — so this stays pure and type-parameterized
// rather than re-implemented per game.

export interface WireRoomState<TGame, TPlayer> {
  game: TGame;
  players: TPlayer[];
}

// Build the exact payload string the backend expects for sync-state.
export function buildStatePayload<TGame, TPlayer>(
  game: TGame,
  players: TPlayer[]
): string {
  return `{"game": ${JSON.stringify(game)}, "players": ${JSON.stringify(
    players
  )} }`;
}

// "state-changed" broadcasts are single-encoded.
export function parseBroadcastState<TGame, TPlayer>(
  state: string
): WireRoomState<TGame, TPlayer> {
  return JSON.parse(state) as WireRoomState<TGame, TPlayer>;
}

// "get-state" returns the DB value, which is double-encoded.
export function parseFetchedState<TGame, TPlayer>(
  state: string
): WireRoomState<TGame, TPlayer> {
  return JSON.parse(JSON.parse(state)) as WireRoomState<TGame, TPlayer>;
}

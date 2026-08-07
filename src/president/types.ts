// Domain types for President (Elnök) — played with a real French deck.
// The app never touches the cards: it only records the order players go out
// in each round, assigns the resulting roles, and tracks score across
// rounds — the same "app manages the match, not the cards" job Rikiki does.

export type PresidentRole = "president" | "vice_president" | "neutral" | "vice_trou" | "trou";

export interface PresidentPlayer {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  online: boolean;
  boss: boolean;
  score: number;
}

export interface PresidentRoundEntry {
  pid: string;
  role: PresidentRole;
  points: number;
}

export interface PresidentRoundResult {
  round: number;
  // Finishing order for that round: entries[0] went out first (President),
  // entries[last] was left holding cards (Trou).
  entries: PresidentRoundEntry[];
}

export interface PresidentGame {
  started: boolean;
  finished: boolean;
  // 1-based number of the round currently being played.
  round: number;
  // Pids that have gone out so far THIS round, in the order they did.
  roundOrder: string[];
  // Completed rounds, newest first.
  history: PresidentRoundResult[];
}

export interface PresidentRoom {
  game: PresidentGame;
  players: PresidentPlayer[];
}

// client -> host actions
export type PresidentAction = {
  type: "finish";
  pid: string;
};

export type WPhase = "lobby" | "clue" | "guess" | "reveal";

export interface WPlayer {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  online: boolean;
  boss: boolean;
  score: number;
  guess: number | null; // 0..100
  guessed: boolean;
  gained?: number; // points from the last round (for reveal)
}

export interface WGame {
  phase: WPhase;
  round: number;
  started: boolean;
  clueGiverPid: string | null;
  left: string;
  right: string;
  target: number; // 0..100, secret until reveal
  clue: string;
  finished?: boolean; // host ended the game -> show final standings
}

export interface WRoom {
  game: WGame;
  players: WPlayer[];
}

// client -> host actions
export type WAction =
  | { type: "clue"; clue: string }
  | { type: "guess"; pid: string; value: number };

// distance (0..100) -> points, Wavelength-style bands
export function scoreFor(distance: number): number {
  if (distance <= 4) return 4;
  if (distance <= 10) return 3;
  if (distance <= 18) return 2;
  if (distance <= 28) return 1;
  return 0;
}

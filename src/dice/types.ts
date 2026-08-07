// Domain types for the Dice roller — not really a "game": no rounds, no
// scoring, just a shared room where anyone can set how many dice to roll
// and everyone sees the same result animate in at the same time.

export interface DicePlayer {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  online: boolean;
  boss: boolean;
}

export interface DiceRollResult {
  values: number[];
  by: string; // pid of whoever pressed the button
}

export interface DiceGame {
  count: number; // how many dice to roll next, 1-6
  // Increments on every roll. Clients diff this (not the values themselves)
  // to know a fresh roll happened and trigger the animation.
  rollSeq: number;
  lastRoll: DiceRollResult | null;
}

export interface DiceRoom {
  game: DiceGame;
  players: DicePlayer[];
}

// client -> host actions
export type DiceAction =
  | { type: "setCount"; count: number }
  | { type: "roll"; pid: string };

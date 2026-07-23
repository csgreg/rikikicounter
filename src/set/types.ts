// Domain types for Set. Attribute values stay English identifiers (matching
// wave/types.ts's WPhase precedent) — only on-screen copy is Hungarian.

export type SCount = 1 | 2 | 3;
export type SColor = "red" | "green" | "purple";
export type SShape = "oval" | "diamond" | "squiggle";
export type SShading = "solid" | "striped" | "empty";

export interface SCard {
  id: string; // deterministic, derived purely from the attribute combo
  count: SCount;
  color: SColor;
  shape: SShape;
  shading: SShading;
}

export interface SetPlayer {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  online: boolean;
  boss: boolean;
  score: number;
}

export interface SetGame {
  started: boolean;
  finished: boolean;
  board: SCard[];
  // Remaining draw pile, in draw order. Rides along in synced state (like
  // Wave's `target`) so a promoted host after a boss handoff can keep dealing.
  deck: SCard[];
  lastClaim: { pid: string; ok: boolean; cardIds: string[] } | null;
}

export interface SetRoom {
  game: SetGame;
  players: SetPlayer[];
}

// client -> host actions
export type SetAction = {
  type: "claim";
  pid: string;
  cardIds: [string, string, string];
};

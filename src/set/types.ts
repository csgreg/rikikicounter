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

export interface SetHistoryEntry {
  pid: string;
  cards: [SCard, SCard, SCard];
}

export interface SetClaimResult {
  pid: string;
  ok: boolean;
}

export interface SetGame {
  started: boolean;
  finished: boolean;
  board: SCard[];
  // Remaining draw pile, in draw order. Rides along in synced state (like
  // Wave's `target`) so a promoted host after a boss handoff can keep dealing.
  deck: SCard[];
  // Every claim outcome this game, oldest first, capped to the most recent
  // CLAIM_LOG_LIMIT entries (see SetContext.tsx). This is a queue rather than
  // a single "lastClaim" slot because two claims can resolve within the same
  // React render tick (e.g. two players claiming moments apart) — a single
  // slot would have the second overwrite the first before the UI ever
  // rendered it, silently dropping that player's +1/-1 marker.
  claimLog: SetClaimResult[];
  // Every successfully found set this game, newest first.
  history: SetHistoryEntry[];
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

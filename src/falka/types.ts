// Domain types for Falka — a from-scratch reimagining of the werewolf/mafia
// party game, built to lean on the app instead of a human moderator. English
// identifiers for role/phase values (matching set/types.ts's precedent) —
// only on-screen copy is Hungarian.

export type FPhase =
  | "lobby"
  | "night" // wolves silently agree on a target; the seer checks someone
  | "dawn" // the night's outcome + evidence, revealed to everyone
  | "day" // discussion timer + private suspicion ratings
  | "vote" // secret simultaneous lynch vote
  | "results" // lynch outcome + role reveal
  | "gameover";

// wildcard is village-aligned but reads as a wolf to the seer's check — a
// built-in red herring the wolves can quietly lean on to deflect suspicion.
export type FRole = "wolf" | "seer" | "wildcard" | "villager";

export interface FPlayer {
  id: number;
  pid: string;
  name: string;
  socketid: string;
  online: boolean;
  boss: boolean;
  role: FRole | null; // assigned at game start; null while in the lobby
  alive: boolean;
  nightVote: string | null; // a wolf's target pid this night
  seerCheckPid: string | null; // the seer's target pid this night
  lynchVote: string | null; // this round's lynch pick, a pid or "skip"
  suspicionBallot: Record<string, number> | null; // ratings THIS player gave, this day
}

export interface SuspicionEntry {
  pid: string;
  avg: number;
}

export interface SeerResult {
  forPid: string; // only this player's client renders it
  targetPid: string;
  isWolf: boolean;
}

// A single "lead" clue that actually points at somebody — templateIndex
// selects the wording (falka.namedEvidence) and pid names the suspect. Kept
// as indices/pid rather than resolved text so every client renders it in
// their OWN chosen language, live, instead of whatever language the host
// happened to have active when the night resolved.
export interface NamedClue {
  templateIndex: number;
  pid: string;
}

export interface FGame {
  started: boolean;
  finished: boolean;
  round: number;
  phase: FPhase;
  phaseDeadline: number | null; // epoch ms; null while the phase has no clock
  winner: "wolves" | "village" | null;
  nightKillPid: string | null;
  seerResult: SeerResult | null;
  evidenceIndices: number[]; // indices into falka.evidence (generic atmosphere pool)
  namedClue: NamedClue | null;
  suspicionRanking: SuspicionEntry[] | null;
  lynchedPid: string | null;
}

export interface FRoom {
  game: FGame;
  players: FPlayer[];
}

// client -> host actions
export type FAction =
  | { type: "wolfVote"; pid: string; targetPid: string }
  | { type: "seerCheck"; pid: string; targetPid: string }
  | { type: "suspicion"; pid: string; ratings: Record<string, number> }
  | { type: "lynchVote"; pid: string; targetPid: string };

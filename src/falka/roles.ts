import type { FPlayer, FRole, NamedClue, SuspicionEntry } from "./types";

// Exact role tables for the two supported room sizes — small enough that a
// generic "N wolves per M players" formula would need as much explaining as
// just spelling out both cases.
const ROLE_SETS: Record<number, FRole[]> = {
  5: ["wolf", "seer", "wildcard", "villager", "villager"],
  6: ["wolf", "wolf", "seer", "wildcard", "villager", "villager"],
};

export function rolesForCount(n: number): FRole[] {
  return ROLE_SETS[n] || (n < 5 ? ROLE_SETS[5] : ROLE_SETS[6]);
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Fresh role shuffle + a clean slate for every per-round field. Used both to
// start a brand-new game and to restart one (same players, new roles).
export function assignRoles(players: FPlayer[]): FPlayer[] {
  const roles = shuffle(rolesForCount(players.length));
  return players.map((p, i) => ({
    ...p,
    role: roles[i] ?? "villager",
    alive: true,
    nightVote: null,
    seerCheckPid: null,
    lynchVote: null,
    suspicionBallot: null,
  }));
}

// Clears every transient per-round field without touching role/alive —
// called once at the top of each new night after the previous round's
// results are dismissed.
export function resetRoundFields(players: FPlayer[]): FPlayer[] {
  return players.map((p) => ({
    ...p,
    nightVote: null,
    seerCheckPid: null,
    lynchVote: null,
    suspicionBallot: null,
  }));
}

// Atmosphere lines shown at dawn alongside the named clue — pure flavor,
// no signal. Indices into the pool (not resolved text) so every client
// renders them in their own chosen language. The pool itself lives in the
// i18n locale files (falka.evidence).
export function pickEvidenceIndices(poolSize: number, count = 2): number[] {
  const indices = Array.from({ length: poolSize }, (_, i) => i);
  return shuffle(indices).slice(0, count);
}

// The one "lead" clue that actually points at somebody — a real, if noisy,
// signal to reason about (unlike the atmosphere lines). Wolves are twice as
// likely to be named as anyone else, so following it is better than a
// coinflip but far from certain; the victim is excluded since they're
// already revealed dead. Returns null if nobody's left to name (e.g. only
// the victim was alive besides the seer, edge case at 5 players).
export function pickNamedClue(
  candidates: FPlayer[],
  templateCount: number
): NamedClue | null {
  if (candidates.length === 0) return null;
  const weighted = candidates.flatMap((p) => (p.role === "wolf" ? [p, p] : [p]));
  const suspect = weighted[Math.floor(Math.random() * weighted.length)];
  return {
    templateIndex: Math.floor(Math.random() * templateCount),
    pid: suspect.pid,
  };
}

// Plurality with random tie-break — used for the wolves' kill target, where a
// decision must land even on a tie.
export function tallyMajority(votes: string[]): string | null {
  if (votes.length === 0) return null;
  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let bestCount = 0;
  let leaders: string[] = [];
  counts.forEach((c, k) => {
    if (c > bestCount) {
      bestCount = c;
      leaders = [k];
    } else if (c === bestCount) {
      leaders.push(k);
    }
  });
  return leaders[Math.floor(Math.random() * leaders.length)];
}

// Plurality for the lynch vote, but a tie (including a tie with "skip")
// means indecision — nobody is lynched.
export function tallyLynch(votes: string[]): string | null {
  if (votes.length === 0) return null;
  const counts = new Map<string, number>();
  votes.forEach((v) => counts.set(v, (counts.get(v) || 0) + 1));
  let bestCount = 0;
  let leaders: string[] = [];
  counts.forEach((c, k) => {
    if (c > bestCount) {
      bestCount = c;
      leaders = [k];
    } else if (c === bestCount) {
      leaders.push(k);
    }
  });
  if (leaders.length !== 1) return null;
  return leaders[0] === "skip" ? null : leaders[0];
}

// Average of the ratings collected on each living player, revealed as a
// ranking only — never who scored whom what.
export function computeSuspicionRanking(players: FPlayer[]): SuspicionEntry[] {
  const alive = players.filter((p) => p.alive);
  const sums = new Map<string, number>();
  const counts = new Map<string, number>();
  alive.forEach((p) => {
    if (!p.suspicionBallot) return;
    Object.entries(p.suspicionBallot).forEach(([targetPid, val]) => {
      sums.set(targetPid, (sums.get(targetPid) || 0) + val);
      counts.set(targetPid, (counts.get(targetPid) || 0) + 1);
    });
  });
  return alive
    .filter((p) => counts.has(p.pid))
    .map((p) => ({
      pid: p.pid,
      avg: (sums.get(p.pid) || 0) / (counts.get(p.pid) || 1),
    }))
    .sort((a, b) => b.avg - a.avg);
}

export function checkWinner(players: FPlayer[]): "wolves" | "village" | null {
  const alive = players.filter((p) => p.alive);
  const wolves = alive.filter((p) => p.role === "wolf").length;
  const others = alive.length - wolves;
  if (wolves === 0) return "village";
  if (wolves >= others) return "wolves";
  return null;
}

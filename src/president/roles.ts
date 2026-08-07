import type { PresidentRole, PresidentRoundEntry } from "./types";

export const ROLE_POINTS: Record<PresidentRole, number> = {
  president: 2,
  vice_president: 1,
  neutral: 0,
  vice_trou: -1,
  trou: -2,
};

// order[0] went out first (President), order[last] was stuck holding cards
// (Trou). Vice-President/Vice-Trou seats only exist once there are enough
// players to make them meaningful (5+) — below that it's just President,
// any number of Citizens, and Trou.
export function assignRoles(order: string[]): PresidentRoundEntry[] {
  const n = order.length;
  return order.map((pid, i) => {
    let role: PresidentRole = "neutral";
    if (i === 0) role = "president";
    else if (i === n - 1) role = "trou";
    else if (n >= 5 && i === 1) role = "vice_president";
    else if (n >= 5 && i === n - 2) role = "vice_trou";
    return { pid, role, points: ROLE_POINTS[role] };
  });
}

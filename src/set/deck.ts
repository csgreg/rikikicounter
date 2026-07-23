import type { SCard, SColor, SCount, SShading, SShape } from "./types";

const COUNTS: SCount[] = [1, 2, 3];
const COLORS: SColor[] = ["red", "green", "purple"];
const SHAPES: SShape[] = ["oval", "diamond", "squiggle"];
const SHADINGS: SShading[] = ["solid", "striped", "empty"];

export function buildFullDeck(): SCard[] {
  const deck: SCard[] = [];
  for (const count of COUNTS) {
    for (const color of COLORS) {
      for (const shape of SHAPES) {
        for (const shading of SHADINGS) {
          deck.push({
            id: `${count}-${color}-${shape}-${shading}`,
            count,
            color,
            shape,
            shading,
          });
        }
      }
    }
  }
  return deck;
}

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sameOrAllDifferent<T>(x: T, y: T, z: T): boolean {
  return (x === y && y === z) || (x !== y && y !== z && x !== z);
}

export function isSet(a: SCard, b: SCard, c: SCard): boolean {
  return (
    sameOrAllDifferent(a.count, b.count, c.count) &&
    sameOrAllDifferent(a.color, b.color, c.color) &&
    sameOrAllDifferent(a.shape, b.shape, c.shape) &&
    sameOrAllDifferent(a.shading, b.shading, c.shading)
  );
}

// O(n^3), but n stays in the ~12-21 range (<=1330 triples) - no perf concern.
export function hasAnySet(board: SCard[]): boolean {
  for (let i = 0; i < board.length; i++) {
    for (let j = i + 1; j < board.length; j++) {
      for (let k = j + 1; k < board.length; k++) {
        if (isSet(board[i], board[j], board[k])) return true;
      }
    }
  }
  return false;
}

// Rule A ("keep 12 on the table") + Rule B ("the table must contain a set"),
// applied together. Handles every top-up AND the initial deal (12 dealt onto
// an empty board is just the same operation, not a special case). Terminates
// because deck.length strictly decreases each iteration and the loop also
// exits once the deck is empty, even for a ~20-card board with zero sets.
export function topUpBoard(
  board: SCard[],
  deck: SCard[]
): { board: SCard[]; deck: SCard[] } {
  let b = board.slice();
  let d = deck.slice();

  if (b.length < 12 && d.length > 0) {
    const need = Math.min(12 - b.length, d.length);
    b = b.concat(d.splice(0, need));
  }

  while (!hasAnySet(b) && d.length > 0) {
    b = b.concat(d.splice(0, Math.min(3, d.length)));
  }

  return { board: b, deck: d };
}

export function dealInitial(): { board: SCard[]; deck: SCard[] } {
  const deck = shuffle(buildFullDeck());
  const firstTwelve = deck.splice(0, 12);
  return topUpBoard(firstTwelve, deck);
}

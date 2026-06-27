import { useEffect, useState } from "react";

// Playful split-flap style counter: a homage to the "Counter" in the name.
// Counts through a deck (1 → 52) and loops; each digit flips like a card.
function FlipDigit({ d }: { d: string }) {
  return (
    <span className="flip-card">
      {/* keyed by value so it re-mounts (and re-animates) only when it changes */}
      <span key={d} className="flip-num">
        {d}
      </span>
    </span>
  );
}

export function DeckCounter() {
  const [n, setN] = useState(1);

  useEffect(() => {
    const id = setInterval(() => setN((p) => (p % 52) + 1), 1600);
    return () => clearInterval(id);
  }, []);

  const s = String(n).padStart(2, "0");

  return (
    <div className="deck-counter" aria-hidden="true" title="…egy pakli lap">
      <FlipDigit d={s[0]} />
      <FlipDigit d={s[1]} />
    </div>
  );
}

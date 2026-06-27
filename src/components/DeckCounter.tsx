import { useEffect, useState } from "react";

// Playful split-flap counter in place of the word "Counter": it rips through
// a deck (1 → 52) in ~1.5–2s, decelerating to a stop, pauses, then repeats.
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
    let timer: ReturnType<typeof setTimeout>;
    let val = 1;

    const run = () => {
      setN(val);
      if (val >= 52) {
        // reached the top of the deck — hold, then start over
        timer = setTimeout(() => {
          val = 1;
          run();
        }, 1300);
        return;
      }
      const p = val / 52;
      const delay = 14 + p * p * 62; // fast start, slows down near 52
      val += 1;
      timer = setTimeout(run, delay);
    };

    run();
    return () => clearTimeout(timer);
  }, []);

  const s = String(n).padStart(2, "0");

  return (
    <span className="deck-counter" aria-hidden="true">
      <FlipDigit d={s[0]} />
      <FlipDigit d={s[1]} />
    </span>
  );
}

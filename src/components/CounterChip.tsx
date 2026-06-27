import { useEffect, useState } from "react";

// The coral "Counter" chip in the title. The whole chip flips like a card on
// each change: shows the word ~10s, then flips through a deck (1 → 52) over
// ~5.5s with an ease-out, holds on 52, repeats.
// Instead of re-mounting (which caused a 1-frame flicker), we re-trigger the
// flip by alternating between two identical animation classes.
export function CounterChip() {
  const [content, setContent] = useState("Counter");
  const [flip, setFlip] = useState(0);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const update = (c: string) => {
      setContent(c);
      setFlip((f) => f + 1);
    };

    const showText = () => {
      update("Counter");
      timer = setTimeout(count, 10000);
    };

    const count = () => {
      let val = 1;
      const step = () => {
        if (cancelled) return;
        update(String(val).padStart(2, "0"));
        if (val >= 52) {
          timer = setTimeout(showText, 800);
          return;
        }
        const p = val / 52;
        val += 1;
        timer = setTimeout(step, 70 + p * p * 110); // ~5.5s, decelerating
      };
      step();
    };

    showText();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return (
    <span
      className={`counter-chip ${flip % 2 ? "flip-a" : "flip-b"}`}
      aria-label="Counter"
    >
      {content}
    </span>
  );
}
